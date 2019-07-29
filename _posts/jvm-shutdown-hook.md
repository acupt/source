---
title: 源码分析 - JVM关闭钩子的注册和调用
date: 2019-07-29 22:00:00
tags:
 - jvm
categories: JAVA
---

> 通过关闭钩子，我们可以在应用关闭时做一些自定义的操作，让程序更优雅的结束。

JAVA程序运行在虚拟机上(JVM)，JAVA程序执行完成，JVM也随之关闭。关闭的方式有多种，根据其行为的文明程度可大概分为两种：

+ 正常关闭
    所有普通线程（非守护线程）执行完毕
    System.exit(status)
    Ctrl - C
    ...
+ 强行关闭
    kill进程
    Runtime.halt(status)
    ...

## JVM关闭钩子DEMO

```java
public class Main {

    public static void main(String[] args) throws Exception {
        Runtime.getRuntime().addShutdownHook(new MyHook());
        System.out.println("结束吧");
    }

    public static class MyHook extends Thread {
        @Override
        public void run() {
            System.out.println("你先走，我垫后");
        }
    }
}

/* 输出:

结束吧
你先走，我垫后

*/
```

## 自定义钩子如何注册

```java
public class Runtime {

    // 钩子对象必须是一个Thread（或其子类）
    public void addShutdownHook(Thread hook) {
        // 看起来是个权限检查
        SecurityManager sm = System.getSecurityManager();
        if (sm != null) {
            sm.checkPermission(new RuntimePermission("shutdownHooks"));
        }
        // 真正的注册逻辑在这个类里面
        ApplicationShutdownHooks.add(hook);
    }
}

class ApplicationShutdownHooks {

    // 钩子集合
    private static IdentityHashMap<Thread, Thread> hooks;

    // 注册一个钩子
    static synchronized void add(Thread hook) {
        if(hooks == null)
            throw new IllegalStateException("Shutdown in progress");

        // 看来注册前不能让Thread跑起来
        if (hook.isAlive())
            throw new IllegalArgumentException("Hook already running");

        // 同一个钩子不能重复注册
        if (hooks.containsKey(hook))
            throw new IllegalArgumentException("Hook previously registered");

        // 放进集合就算注册成功了？继续往下看
        hooks.put(hook, hook);
    }

    // 初始化，本来在最前面，为了跟随我的节奏被我移到后面了
    static {
        try {
            // 看来这个类也不是真正实现钩子回调的地方
            // 又在Shutdown注册了一个“钩子”，通过这个“钩子”来执行用户自定义的钩子
            Shutdown.add(1 /* shutdown hook invocation order */,
                false /* not registered if shutdown in progress */,
                new Runnable() {
                    public void run() {
                        runHooks();
                    }
                }
            );
            hooks = new IdentityHashMap<>();
        } catch (IllegalStateException e) {
            // application shutdown hooks cannot be added if
            // shutdown is in progress.
            hooks = null;
        }
    }

    // 执行用户钩子的钩子函数
    static void runHooks() {
        Collection<Thread> threads;
        synchronized(ApplicationShutdownHooks.class) {
            threads = hooks.keySet();
            hooks = null;
        }

        for (Thread hook : threads) {
            hook.start();
        }
        for (Thread hook : threads) {
            while (true) {
                try {
                    hook.join();
                    break;
                } catch (InterruptedException ignored) {
                }
            }
        }
    }
}
```

简单追踪了一下注册钩子的源码，发现是通过在Shutdown注册一个钩子来执行用户的钩子。那么Shutdown又是怎么在关闭时执行钩子的呢？

## 钩子如何被调用

```java
package java.lang;
class Shutdown {
    /* Shutdown state */
    private static final int RUNNING = 0;
    private static final int HOOKS = 1;
    private static final int FINALIZERS = 2;
    private static int state = RUNNING;

    /* Should we run all finalizers upon exit? */
    private static boolean runFinalizersOnExit = false;

    // The system shutdown hooks are registered with a predefined slot.
    // The list of shutdown hooks is as follows:
    // (0) Console restore hook
    // (1) Application hooks
    // (2) DeleteOnExit hook

    // 钩子集合容量，有点小，但是看注释目前就3个，倒是足够了，不知道有没有没列出来的
    private static final int MAX_SYSTEM_HOOKS = 10;

    // 钩子集合
    private static final Runnable[] hooks = new Runnable[MAX_SYSTEM_HOOKS];

    // 注册一个钩子
    static void add(int slot, boolean registerShutdownInProgress, Runnable hook) {
        synchronized (lock) {
            if (hooks[slot] != null)
                throw new InternalError("Shutdown hook at slot " + slot + " already registered");

            if (!registerShutdownInProgress) {
                if (state > RUNNING)
                    throw new IllegalStateException("Shutdown in progress");
            } else {
                if (state > HOOKS || (state == HOOKS && slot <= currentRunningHook))
                    throw new IllegalStateException("Shutdown in progress");
            }
            // 刚才ApplicationShutdownHooks传的是：(1) Application hooks
            hooks[slot] = hook;
        }
    }

    // 除了add，这是唯一引用hooks的地方了
    // 可以看出是顺序执行3种钩子
    private static void runHooks() {
        for (int i=0; i < MAX_SYSTEM_HOOKS; i++) {
            try {
                Runnable hook;
                synchronized (lock) {
                    // acquire the lock to make sure the hook registered during
                    // shutdown is visible here.
                    currentRunningHook = i;
                    hook = hooks[i];
                }
                if (hook != null) hook.run();
            } catch(Throwable t) {
                if (t instanceof ThreadDeath) {
                    ThreadDeath td = (ThreadDeath)t;
                    throw td;
                }
            }
        }
    }

    // 执行钩子的地方
    private static void sequence() {
        synchronized (lock) {
            /* Guard against the possibility of a daemon thread invoking exit
             * after DestroyJavaVM initiates the shutdown sequence
             */
            if (state != HOOKS) return;
        }
        runHooks();//执行钩子
        boolean rfoe;
        synchronized (lock) {
            state = FINALIZERS;
            rfoe = runFinalizersOnExit;
        }
        if (rfoe) runAllFinalizers();
    }

    // 下面两个方法是我们触发应用关闭的途径，均可执行钩子

    /* Invoked by Runtime.exit, which does all the security checks.
     * Also invoked by handlers for system-provided termination events,
     * which should pass a nonzero status code.
     */
    // 强行翻译：通过Runtime.exit调用
    // 这是我们可以在程序中调用到的
    static void exit(int status) {
        boolean runMoreFinalizers = false;
        synchronized (lock) {
            if (status != 0) runFinalizersOnExit = false;
            switch (state) {
            case RUNNING:       /* Initiate shutdown */
                state = HOOKS;
                break;
            case HOOKS:         /* Stall and halt */
                break;
            case FINALIZERS:
                if (status != 0) {
                    /* Halt immediately on nonzero status */
                    halt(status);
                } else {
                    /* Compatibility with old behavior:
                     * Run more finalizers and then halt
                     */
                    runMoreFinalizers = runFinalizersOnExit;
                }
                break;
            }
        }
        if (runMoreFinalizers) {
            runAllFinalizers();
            halt(status);
        }
        synchronized (Shutdown.class) {
            /* Synchronize on the class object, causing any other thread
             * that attempts to initiate shutdown to stall indefinitely
             */
            sequence();//执行钩子
            halt(status);
        }
    }

    /* Invoked by the JNI DestroyJavaVM procedure when the last non-daemon
     * thread has finished.  Unlike the exit method, this method does not
     * actually halt the VM.
     */
    // 强行翻译：最后一个非守护线程结束后通过本地接口（JNI）调用。和exit方法不同，此方法没有真正停止虚拟机
    // 这个方法没有找到调用的代码
    static void shutdown() {
        synchronized (lock) {
            switch (state) {
            case RUNNING:       /* Initiate shutdown */
                state = HOOKS;
                break;
            case HOOKS:         /* Stall and then return */
            case FINALIZERS:
                break;
            }
        }
        synchronized (Shutdown.class) {
            sequence();// 执行钩子
        }
    }
```

简单的看了下源码，知道了exit和shutdown时都会通过某种流程和规则去执行到用户定义的钩子。