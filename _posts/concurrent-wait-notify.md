---
title: 探索JAVA并发 - 终于搞懂了sleep/wait/notify/notifyAll
date: 2019-08-14 22:30:00
tags:
 - 线程
 - 同步
categories: 并发编程
---

> sleep/wait/notify/notifyAll分别有什么作用？它们的区别是什么？wait时为什么要放在循环里而不能直接用if？

## 简介

首先对几个相关的方法做个简单解释，Object中有几个用于线程同步的方法：wait、notify、notifyAll。

```java
public class Object {
    public final native void wait(long timeout) throws InterruptedException;
    public final native void notify();
    public final native void notifyAll();
}
```

+ wait: 释放当前锁，阻塞直到被notify或notifyAll唤醒，或者超时，或者线程被中断(InterruptedException)
+ notify: 任意选择一个（无法控制选哪个）正在这个对象上等待的线程把它唤醒，其它线程依然在等待被唤醒
+ notifyAll: 唤醒所有线程，让它们去竞争，不过也只有一个能抢到锁
+ sleep: 不是Object中的方法，而是Thread类的静态方法，让当前线程持有锁阻塞指定时间

## sleep和wait

sleep和wait都可以让线程阻塞，也都可以指定超时时间，甚至还都会抛出中断异常InterruptedException。

而它们最大的区别就在于，sleep时线程依然持有锁，别人无法进当前同步方法；wait时放弃了持有的锁，其它线程有机会进入该同步方法。多次提到同步方法，因为wait必须在synchronized同步代码块中，否则会抛出异常IllegalMonitorStateException，notify也是如此，可以说wait和notify是就是为了在同步代码中做线程调度而生的。

下面一个简单的例子展现sleep和wait的区别：

```java
import java.util.Date;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    // 日志行号记录
    private AtomicInteger count = new AtomicInteger();

    public static void main(String[] args) throws InterruptedException {
        Main main = new Main();
        // 开启两个线程去执行test方法
        new Thread(main::test).start();
        new Thread(main::test).start();
    }

    private synchronized void test() {
        try {
            log("进入了同步方法，并开始睡觉，1s");
            // sleep不会释放锁，因此其他线程不能进入这个方法
            Thread.sleep(1000);
            log("睡好了，但没事做，有事叫我，等待2s");
            //阻塞在此，并且释放锁，其它线程可以进入这个方法
            //当其它线程调用此对象的notify或者notifyAll时才有机会停止阻塞
            //就算没有人notify，如果超时了也会停止阻塞
            wait(2000);
            log("我要走了，但我要再睡一觉，10s");
            //这里睡的时间很长，因为没有释放锁，其它线程就算wait超时了也无法继续执行
            Thread.sleep(10000);
            log("走了");
            notify();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    // 打印日志
    private void log(String s) {
        System.out.println(count.incrementAndGet() + " "
                + new Date().toString().split(" ")[3]
                + "\t" + Thread.currentThread().getName() + " " + s);
    }
}

/* 输出:

1 00:13:23	Thread-0 进入了同步方法，并开始睡觉，1s
2 00:13:24	Thread-0 睡好了，但没事做，有事叫我，等待2s
3 00:13:24	Thread-1 进入了同步方法，并开始睡觉，1s
4 00:13:25	Thread-1 睡好了，但没事做，有事叫我，等待2s
5 00:13:26	Thread-0 我要走了，但我要再睡一觉，10s
6 00:13:36	Thread-0 走了
7 00:13:36	Thread-1 我要走了，但我要再睡一觉，10s
8 00:13:46	Thread-1 走了

*/
```

对输出做个简单解释（已经看懂代码的童鞋可以跳过）：

```
1 00:13:23	Thread-0 进入了同步方法，并开始睡觉，1s     // Thread-0首先进入同步方法，Thread-1只能门外候着
2 00:13:24	Thread-0 睡好了，但没事做，有事叫我，等待2s  // Thread-0 sleep 1秒这段时间，Thread-1没进来，证明sleep没有释放锁
3 00:13:24	Thread-1 进入了同步方法，并开始睡觉，1s     // Thread-0开始wait后Thread-1马上就进来了，证明wait释放了锁
4 00:13:25	Thread-1 睡好了，但没事做，有事叫我，等待2s  // Thread-1也打算wait 2秒（2秒后真的能醒来吗？）
5 00:13:26	Thread-0 我要走了，但我要再睡一觉，10s      // Thread-0已经wait超时醒来了，这次准备sleep 10s
6 00:13:36	Thread-0 走了                           // 10s过去了Thread-0都sleep结束了，那个说要wait 2s的Thread-1还没动静，证明超时也没用，还得抢到锁
7 00:13:36	Thread-1 我要走了，但我要再睡一觉，10s     // Thread-0退出同步代码后，Thread-1才终于得到了锁，能行动了
8 00:13:46	Thread-1 走了
```

## notify和notifyAll

同样是唤醒等待的线程，同样最多只有一个线程能获得锁，同样不能控制哪个线程获得锁。

区别在于：

+ notify：唤醒一个线程，其他线程依然处于wait的等待唤醒状态，如果被唤醒的线程结束时没调用notify，其他线程就永远没人去唤醒，只能等待超时，或者被中断
+ notifyAll：所有线程退出wait的状态，开始竞争锁，但只有一个线程能抢到，这个线程执行完后，其他线程又会有一个幸运儿脱颖而出得到锁

如果觉得解释的不够明白，代码来一波：

```java
import java.util.Date;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    private AtomicInteger count = new AtomicInteger();

    public static void main(String[] args) throws InterruptedException {
        Main main = new Main();
        // 开启两个线程去执行test方法
        for (int i = 0; i < 10; i++) {
            new Thread(main::testWait).start();
        }
        Thread.sleep(1000);
        for (int i = 0; i < 5; i++) {
            main.testNotify();
        }
    }

    private synchronized void testWait() {
        try {
            log("进入了同步方法，开始wait");
            wait();
            log("wait结束");
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    private synchronized void testNotify() {
        notify();
    }

    private void log(String s) {
        System.out.println(count.incrementAndGet() + " "
                + new Date().toString().split(" ")[3]
                + "\t" + Thread.currentThread().getName() + " " + s);
    }

}

/* 输出:

1 00:59:32	Thread-0 进入了同步方法，开始wait
2 00:59:32	Thread-9 进入了同步方法，开始wait
3 00:59:32	Thread-8 进入了同步方法，开始wait
4 00:59:32	Thread-7 进入了同步方法，开始wait
5 00:59:32	Thread-6 进入了同步方法，开始wait
6 00:59:32	Thread-5 进入了同步方法，开始wait
7 00:59:32	Thread-4 进入了同步方法，开始wait
8 00:59:32	Thread-3 进入了同步方法，开始wait
9 00:59:32	Thread-2 进入了同步方法，开始wait
10 00:59:32	Thread-1 进入了同步方法，开始wait
11 00:59:33	Thread-0 wait结束
12 00:59:33	Thread-6 wait结束
13 00:59:33	Thread-7 wait结束
14 00:59:33	Thread-8 wait结束
15 00:59:33	Thread-9 wait结束

*/
```

例子中有10个线程在wait，但notify了5次，然后其它线程一直阻塞，这也就说明使用notify时如果不能准确控制和wait的线程数对应，可能会导致某些线程永远阻塞。

使用notifyAll唤醒所有等待的线程：

```java
import java.util.Date;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    private AtomicInteger count = new AtomicInteger();

    public static void main(String[] args) throws InterruptedException {
        Main main = new Main();
        // 开启两个线程去执行test方法
        for (int i = 0; i < 5; i++) {
            new Thread(main::testWait).start();
        }
        Thread.sleep(1000);
        main.testNotifyAll();
    }

    private synchronized void testWait() {
        try {
            log("进入了同步方法，开始wait");
            wait();
            log("wait结束");
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }

    private synchronized void testNotifyAll() {
        notifyAll();
    }

    private void log(String s) {
        System.out.println(count.incrementAndGet() + " "
                + new Date().toString().split(" ")[3]
                + "\t" + Thread.currentThread().getName() + " " + s);
    }

}

/* 输出:

1 01:03:24	Thread-0 进入了同步方法，开始wait
2 01:03:24	Thread-4 进入了同步方法，开始wait
3 01:03:24	Thread-3 进入了同步方法，开始wait
4 01:03:24	Thread-2 进入了同步方法，开始wait
5 01:03:24	Thread-1 进入了同步方法，开始wait
6 01:03:25	Thread-1 wait结束
7 01:03:25	Thread-2 wait结束
8 01:03:25	Thread-3 wait结束
9 01:03:25	Thread-4 wait结束
10 01:03:25	Thread-0 wait结束

*/
```

只需要调用一次notifyAll，所有的等待线程都被唤醒，并且去竞争锁，然后依次（无序）获取锁完成了后续任务。

## 为什么wait要放到循环中使用

一些源码中出现wait时，往往都是伴随着一个循环语句出现的，比如：

```java
private synchronized void f() throws InterruptedException {
    while (!isOk()) {
        wait();
    }
    System.out.println("I'm ok");
}
```

既然wait会被阻塞直到被唤醒，那么用if+wait不就可以了吗？其他线程发现条件达到时notify一下不就行了？

理想情况确实如此，但实际开发中我们往往不能保证这个线程被notify时条件已经满足了，因为很可能有某个无关(和这个条件的逻辑无关)的线程因为需要线程调度而调用了notify或者notifyAll。此时如果样例中位置等待的线程不巧被唤醒，它就会继续往下执行，但因为用的if，这次被唤醒就不会再判断条件是否满足，最终程序按照我们不期望的方式执行下去。