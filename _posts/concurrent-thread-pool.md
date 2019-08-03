---
title: 探索JAVA并发 - 线程池详解
date: 2019-07-30 21:55:00
tags:
 - 线程
 - 线程池
categories: 并发编程
---

> 线程池是并发编程中必不可少的一种工具，也是面试高频话题。

线程池，即管理着若干线程的资源池（字面意思）。相比于为每个任务分配一个线程，在线程池中执行任务优势更多：

1. 线程复用：线程池中的线程是可以复用的，省去了创建、销毁线程的开销，提高了资源利用率（创建、销毁等操作都是要消耗系统资源的）和响应速度（任务提交过来线程已存在就不用等待线程创建了）；
2. 合理利用资源：通过调整线程池大小，让所有处理器尽量保持忙碌，又能防止过多线程产生过多竞争浪费资源；

常用的线程池主要是ThreadPoolExecutor 和 ScheduledThreadPoolExecutor(定时任务线程池，继承ThreadPoolExecutor)。
 
## Executor框架

> 在JAVA中，任务执行的主要抽象不是Thread，而是Executor。Executor基于生产者-消费者模式，提交任务的操作相当于生产者，执行任务的线程相当于消费者。

所谓Executor框架，其实就是定义了一个接口，我们常用的线程池ThreadPoolExecutor就是对这个接口的一种实现。

```java
public interface Executor {

    /**
     * Executes the given command at some time in the future.  The command
     * may execute in a new thread, in a pooled thread, or in the calling
     * thread, at the discretion of the {@code Executor} implementation.
     *
     * @param command 可执行的任务
     * @throws RejectedExecutionException 任务可能被拒绝（当Executor处理不了的时候）
     * @throws NullPointerException if command is null
     */
    void execute(Runnable command);
}
```

## Executors与常用线程池

> Executors其实就是Executor(加s)

Executors是一个Executor的工厂，有很多定义好的工厂方法，可以帮助懒惰的开发者快速创建一个线程池。下面是几个常用的工厂方法：

+ newFixedThreadPool 固定长度线程池，每次提交任务都会创建一个新线程，直到线程数量达到指定阈值则不再创建新的；
+ newCachedThreadPool 可缓存线程池，每次提交任务都会创建一个新线程（理论上无限制），部分任务执行完后如果没有新的任务，导致某些线程无用武之地，它们将被终结；
+ newSingleThreadExecutor 只有一个线程的线程池；
+ newScheduledThreadPool 可以延时或者定时执行任务的线程池。

```java
public class Executors {

    public static ExecutorService newFixedThreadPool(int nThreads) {
        return new ThreadPoolExecutor(nThreads, nThreads,
                                      0L, TimeUnit.MILLISECONDS,
                                      new LinkedBlockingQueue<Runnable>());
    }

    public static ExecutorService newCachedThreadPool() {
        return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                      60L, TimeUnit.SECONDS,
                                      new SynchronousQueue<Runnable>());
    }

    public static ExecutorService newSingleThreadExecutor() {
        return new FinalizableDelegatedExecutorService
            (new ThreadPoolExecutor(1, 1,
                                    0L, TimeUnit.MILLISECONDS,
                                    new LinkedBlockingQueue<Runnable>()));
    }

    public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize) {
        return new ScheduledThreadPoolExecutor(corePoolSize);
    }
}
```

如果查看上述工厂方法的源码，会发现只是new了一个线程池对象返回给调用者而已，没什么花里胡哨的东西。不过看看构造参数还真不少，通过这种方式比起我们自己new一个线程池要简单多了（才怪）。

## 线程池构造参数

了解线程池构造参数的意义，能让我们更清楚程序执行逻辑。

+ int corePoolSize : 核心线程数，有新任务来时，如果当前线程小于核心线程，则新建一个线程来执行该任务
+ int maximumPoolSize : 最大线程数，线程池最多拥有的线程数
+ long keepAliveTime : 空闲线程存活时间
+ TimeUnit unit : 空闲线程存活时间的单位
+ BlockingQueue<Runnable> workQueue : 存放待执行任务的阻塞队列，新任务来时，若当前线程数>=最大核心线程数，则放到这个队列(具体逻辑更复杂，请看下面源码分析)
+ ThreadFactory threadFactory : 创建新线程的工厂，一般用来给线程取个名字方便排查问题
+ RejectedExecutionHandler handler : 任务被拒绝后的处理器，默认的处理器会直接抛出异常，建议重新实现

配合源码，效果更佳：

```java
public class ThreadPoolExecutor extends AbstractExecutorService {

    // 构造函数
    public ThreadPoolExecutor(int corePoolSize, // 核心线程数
                              int maximumPoolSize, // 最大线程数
                              long keepAliveTime, // 空闲线程存活时间
                              TimeUnit unit, // 空闲线程存活时间的单位
                              BlockingQueue<Runnable> workQueue, // 存放待执行任务的阻塞队列
                              ThreadFactory threadFactory, // 创建新线程的工厂
                              RejectedExecutionHandler handler // 任务被拒绝后的处理器
                                                                ) {
        // ...
    }

    // 提交任务
    public void execute(Runnable command) {
        if (command == null)
            throw new NullPointerException();
        /*
         * 没翻，懒得翻
         * Proceed in 3 steps:
         *
         * 1. If fewer than corePoolSize threads are running, try to
         * start a new thread with the given command as its first
         * task.  The call to addWorker atomically checks runState and
         * workerCount, and so prevents false alarms that would add
         * threads when it shouldn't, by returning false.
         *
         * 2. If a task can be successfully queued, then we still need
         * to double-check whether we should have added a thread
         * (because existing ones died since last checking) or that
         * the pool shut down since entry into this method. So we
         * recheck state and if necessary roll back the enqueuing if
         * stopped, or start a new thread if there are none.
         *
         * 3. If we cannot queue task, then we try to add a new
         * thread.  If it fails, we know we are shut down or saturated
         * and so reject the task.
         */
        
        // 当前状态值
        int c = ctl.get();
        // 当前线程数 = workerCountOf(c) 小于 核心线程数 的上限时
        // 直接创建一个线程来执行任务
        if (workerCountOf(c) < corePoolSize) {
            // 并发提交场景下可能会失败
            if (addWorker(command, true))
                return; // 新增成功就可以结束了
            // 失败就更新下线程池状态
            c = ctl.get();
        }
        // 不能创建核心线程来执行，并不会直接创建非核心线程，而是把任务暂存到阻塞队列
        // isRunning(c)判断线程池是否还在运行
        // workQueue.offer(command)返回值表示是否成功提交到队列
        if (isRunning(c) && workQueue.offer(command)) {
            // 成功放到队列里了，再检查一下线程池状态
            int recheck = ctl.get();
            // 如果线程池已经没有运行了，则尝试把新增的任务从队列移除
            // remove(command)返回值表示是否移除成功
            if (! isRunning(recheck) && remove(command))
                reject(command); // 移除成功后，执行拒绝策略
            // 检查下当前线程数是否为0，如果是的话新建一个线程
            else if (workerCountOf(recheck) == 0)
                addWorker(null, false);
        }
        // 线程池没有运行，或者放入队列失败（比如队列已满）
        // 则创建非核心线程去执行任务，这也失败就只能拒绝了
        else if (!addWorker(command, false))
            reject(command);
    }
```

当对线程池的构造参数和任务处理逻辑有了以上大致的了解后，回想Executors提供的几个工厂方法，或许会感到所谓提供便利性的方法并不那么便利。因为从方法的名字上来看很难和线程池的配置准确关联，想要清除地知道这些方法创建的线程池如何运作，就需要知道他们用了怎样的构造参数，那为什么不直接使用构造方法呢？

所以尽量使用构造方法是更好的编程习惯，这样不管是作者还是其他开发者，只要看看传了什么参数，就知道这个线程池是怎么运作的了。

## 线程池创建示例

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    public static void main(String[] args) throws Exception {
        AtomicInteger threadCount = new AtomicInteger();
        ThreadPoolExecutor executor = new ThreadPoolExecutor(
                5,  // 核心线程数
                10, // 最大线程数
                1,  // 空闲线程存活时间
                TimeUnit.MINUTES, // 空闲线程存活时间单位
                new ArrayBlockingQueue<>(100), // 一个指定上限的阻塞队列，存放待执行任务
                new ThreadFactory() {
                    // 自定义一个线程工厂来给线程池里的线程取名字
                    @Override
                    public Thread newThread(Runnable r) {
                        return new Thread(r, "pool-thread-" 
                            + threadCount.incrementAndGet());
                    }
                },
                new RejectedExecutionHandler() {
                    // 自定义一个拒绝处理策略，安慰被线程池拒之门外的小可怜
                    @Override
                    public void rejectedExecution(Runnable r, ThreadPoolExecutor executor) {
                        System.out.println("线程池拒绝了任务: " + r);
                    }
                }
        );
    }

}
```

## 有返回值的提交方式

### submit

ThreadPoolExecutor.execute()方法是没有返回值的，也就是说把任务提交给线程池后，我们就失去了它的消息，除非你还保留着它的引用，并且在里面有维护状态。如果不想这么麻烦，可以使用ThreadPoolExecutor.submit()来提交任务，这个方法会返回一个Future对象，通过这个对象可以知道任务何时被执行完。

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    public static void main(String[] args) throws Exception {
        // 线程池定义
        // ...

        Future<?> future = executor.submit(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                System.out.println("我要关注: 一杯82年的JAVA");
            }
        });
        Object r = future.get();
        System.out.println("返回：" + r);
        executor.shutdown();
    }

}

/* 输出: 

我要关注: 一杯82年的JAVA
返回：null

*/
```

可以看到Future.get()是有返回值的，但是上面的例子返回了null，因为任务是一个Runnable实现，run方法没有返回值。

### submit Callable

如果想任务有返回值，可以使用Callable作为任务定义。

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    public static void main(String[] args) throws Exception {
        // 线程池定义
        // ...

        Future<String> future = executor.submit(new Callable<String>() {
            @Override
            public String call() throws Exception {
                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                System.out.println("I'm fine, and you?");
                return "我要关注: 一杯82年的JAVA";
            }
        });
        String r = future.get();
        System.out.println("返回：" + r);
        executor.shutdown();
    }

}

/* 返回:

I'm fine, and you?
返回：我要关注: 一杯82年的JAVA

*/
```

### submit实现原理

为什么submit就可以让用户等待、获取任务返回？从源码讲起：

```java
public abstract class AbstractExecutorService implements ExecutorService {
    
    public <T> Future<T> submit(Callable<T> task) {
        if (task == null) throw new NullPointerException();
        // 把任务用一个RunnableFuture又给包装了一下
        RunnableFuture<T> ftask = newTaskFor(task);
        // 最后还是调用了没有返回值的execute
        execute(ftask);
        return ftask;
    }

    protected <T> RunnableFuture<T> newTaskFor(Callable<T> callable) {
        return new FutureTask<T>(callable);
    }
}

// 看看这个包装类
public class FutureTask<V> implements RunnableFuture<V> {

     private Callable<V> callable;
     private volatile int state;

     // 也是Runable的一种实现，所以能在线程池中被执行
     public void run() {
        // 有个表示状态的标识 
        if (state != NEW ||
            !UNSAFE.compareAndSwapObject(this, runnerOffset,
                                         null, Thread.currentThread()))
            return;
        try {
            Callable<V> c = callable;
            if (c != null && state == NEW) {
                V result;
                boolean ran;
                try {
                    // 执行用户的逻辑，获得返回值
                    // 这个步骤可能需要点时间
                    result = c.call();
                    ran = true;
                } catch (Throwable ex) {
                    result = null;
                    ran = false;
                    setException(ex);
                }
                if (ran)
                    set(result);
            }
        } finally {
            // runner must be non-null until state is settled to
            // prevent concurrent calls to run()
            runner = null;
            // state must be re-read after nulling runner to prevent
            // leaked interrupts
            int s = state;
            if (s >= INTERRUPTING)
                handlePossibleCancellationInterrupt(s);
        }
    }

    // 获取执行结果，阻塞直到状态改变
    public V get() throws InterruptedException, ExecutionException {
        int s = state;
        if (s <= COMPLETING)
            s = awaitDone(false, 0L);
        return report(s);
    }
}
```

小结：submit时用一个FutureTask把用户提交的Callable包装起来，再把FutureTask提交给线程池执行，FutureTask.run运行时会执行Callable中的业务代码，并且过程中FutureTask会维护一个状态标识，根据状态标识，可以知道任务是否执行完成，也可以阻塞到状态为完成获取返回值。

## 关闭线程池

为什么需要关闭线程池？

1. 如果线程池里的线程一直存活，而且这些线程又不是守护线程，那么会导致虚拟机无法正常退出；
2. 如果直接粗暴地结束应用，线程池中的任务可能没执行完，业务将处于未知状态；
3. 线程中有些该释放的资源没有被释放。

怎么关闭线程池？

1. shutdown 停止接收新任务（继续提交会被拒绝，执行拒绝策略），但已提交的任务会继续执行，全部完成后线程池彻底关闭；
2. shutdownNow 立即停止线程池，并尝试终止正在进行的线程（通过中断），返回没执行的任务集合；
3. awaitTermination 阻塞当前线程，直到全部任务执行完，或者等待超时，或者被中断。

由于shutdownNow的终止线程是通过中断，这个方式并不能保证线程会提前停止。（关于中断: [如何处理线程中断](/2019/07/25/concurrent-interrupt/)）

一般先调用shutdown让线程池停止接客，然后调用awaitTermination等待正在工作的线程完事。

```java
// 你的池子对我打了烊
executor.shutdown();

// 等待一首歌的时间（bei~bei~~）
// 如果超时还没结束返回false，你可以选择再等一首长点的歌，或者不等了
boolean ok = executor.awaitTermination(4, TimeUnit.SECONDS);
```

## 扩展线程池

线程池提供了一些扩展的方法，通过重写这些方法可以添加前置、后置操作，让使用更灵活。如beforeExecute、afterExecute、terminated ...

## 总结

线程池很好用，但使用不当会造成严重的后果，了解它各个属性表示的含义以及执行的流程能帮助我们少踩坑。

举个例子：如果设置了核心线程 < 最大线程数不等（一般都这么设置），但是又设置了一个很大的阻塞队列，那么很可能只有几个核心线程在工作，普通线程一直没机会被创建，因为核心线程满了会优先放到队列里，而不是创建普通线程。