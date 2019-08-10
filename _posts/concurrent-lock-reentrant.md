---
title: 探索JAVA并发 - 可重入锁和不可重入锁
date: 2019-08-08 22:30:00
tags:
 - 并发
 - 锁
categories: 并发编程
---

> 什么是可重入锁，什么是不可重入锁，它们是如何实现的？

## 定义

+ 可重入锁：当线程获取某个锁后，还可以继续获取它，可以递归调用，而不会发生死锁；
+ 不可重入锁：与可重入相反，获取锁后不能重复获取，否则会死锁（自己锁自己）。

## 不可重入锁

用代码说话。

### 基于 wait/notify 实现不可重入锁

```java
import java.util.concurrent.locks.ReentrantLock;

/**
 * 不可重入锁
 */
public class ReentrantForbiddenLock {

    private Thread owner;// 持有锁的线程，为空表示无人占有

    /**
     * 获取锁，锁被占用时阻塞直到锁被释放
     *
     * @throws InterruptedException 等待锁时线程被中断
     */
    public synchronized void lock() throws InterruptedException {
        Thread thread = Thread.currentThread();
        // wait()方法一般和while一起使用，防止因其它原因唤醒而实际没达到期望的条件
        while (owner != null) {
            System.out.println(String.format("%s 等待 %s 释放锁", 
                thread.getName(), owner.getName()));
            wait(); // 阻塞，直到被唤起
        }
        System.out.println(thread.getName() + " 获得了锁");
        owner = thread;//成功上位
    }

    public synchronized void unlock() {
        //只有持有锁的线程才有资格释放锁，别的线程不能强迫它
        if (Thread.currentThread() != owner) {
            throw new IllegalMonitorStateException();
        }
        System.out.println(owner.getName() + " 释放了持有的锁");
        owner = null;
        notify();//唤醒一个等待锁的线程，也可以用notifyAll()
    }

    public static void main(String[] args) throws InterruptedException {
        ReentrantForbiddenLock lock = new ReentrantForbiddenLock();
        lock.lock(); // 获取锁
        lock.lock(); // 还想再来一次
    }
}

/* 输出:
main 获得了锁
main 等待 main 释放锁
*/
```

第二次调用lock后线程就阻塞了，线程开始等待持有锁的线程放手，然而是它是它就是它。

### 基于自旋锁实现不可重入锁

自旋锁，即获取锁的线程在锁被占用时，不是阻塞，而是不断循环去尝试，直到获取锁。

+ 好处：线程保持活跃，减少了线程切换的开销
+ 缺点：很消耗CPU，特别是等待时间很长时

```java
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 不可重入锁
 */
public class ReentrantForbiddenLock {

    // 原子引用：持有锁的线程，为空表示无人占有
    private AtomicReference<Thread> owner = new AtomicReference<>();

    /**
     * 获取锁，锁被占用时阻塞直到锁被释放
     * 使用CAS原子操作，不用synchronized同步了
     */
    public void lock() {
        Thread thread = Thread.currentThread();
        // compareAndSet: 原子操作，依赖操作系统底层实现
        // 如果当前持有值为null，则替换为thread，并返回true，否则返回false
        while (!owner.compareAndSet(null, thread)) {
            // 真正用时可不敢这样打印，那输出太多了
            System.out.println(String.format("%s 等待 %s 释放锁",
                thread.getName(), owner.get().getName()));
        }
        System.out.println(thread.getName() + " 获得了锁");
    }

    public void unlock() {
        Thread thread = Thread.currentThread();
        if (owner.compareAndSet(thread, null)) {
            System.out.println(thread.getName() + " 释放了锁");
            return;
        }
        //只有持有锁的线程才有资格释放锁，别的线程不能强迫它
        throw new IllegalMonitorStateException();
    }

    public static void main(String[] args) throws InterruptedException {
        ReentrantForbiddenLock lock = new ReentrantForbiddenLock();
        lock.lock();
        lock.lock();
    }
}
/* 输出:

main 获得了锁
main 等待 main 释放锁
main 等待 main 释放锁
main 等待 main 释放锁
...

*/
```

如果不想磁盘爆掉，不要在自旋过程中随便打印日志😈

## 可重入锁

不可重入锁扩展一下，增加一个计数器，同一个线程每次获取锁计数器加1，释放锁减1，为0时释放锁。

### 基于自旋锁实现可重入锁

直接用上个例子的代码改一下：

```java
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 不可重入锁
 */
public class ReentrantForbiddenLock {

    // 原子引用：持有锁的线程，为空表示无人占有
    private AtomicReference<Thread> owner = new AtomicReference<>();

    // 计数器
    private int count;

    /**
     * 获取锁，锁被占用时阻塞直到锁被释放
     */
    public void lock() {
        Thread thread = Thread.currentThread();
        if (thread == owner.get()) {
            count++;
            System.out.println(thread.getName() + " 再次获得了锁， count = " + count);
            return;
        }
        // compareAndSet: 原子操作，依赖操作系统底层实现
        // 如果当前持有值为null，则替换为thread，并返回true，否则返回false
        while (!owner.compareAndSet(null, thread)) {
            // 真正用时可不敢这样打印，那输出太多了
            System.out.println(String.format("%s 等待 %s 释放锁",
                    thread.getName(), owner.get().getName()));
        }
        count = 1;//为了便于理解初始化为1
        System.out.println(thread.getName() + " 获得了锁");
    }

    public void unlock() {
        Thread thread = Thread.currentThread();
        if (thread == owner.get()) {
            count--;
            System.out.println(thread.getName() + " 释放了锁，count = " + count);
            if (count == 0) {
                owner.set(null);
                System.out.println(thread.getName() + " 彻底释放了锁");
            }
            return;
        }
        //只有持有锁的线程才有资格释放锁，别的线程不能强迫它
        throw new IllegalMonitorStateException();
    }

    public static void main(String[] args) throws InterruptedException {
        ReentrantForbiddenLock lock = new ReentrantForbiddenLock();
        lock.lock();
        lock.lock();
        lock.unlock();
        lock.unlock();
    }
}

/* 输出:

main 获得了锁
main 再次获得了锁， count = 2
main 释放了锁，count = 1
main 释放了锁，count = 0
main 彻底释放了锁

*/
```

### 可重入锁 synchronized

没错，用于声明同步方法/代码块的synchronized关键字提供的也是一个可重入锁。

同步方法递归测试：

```java

public class Main {

    public static void main(String[] args) throws Exception {
        new Thread(() -> {
            lock(5);
        }).start();
        Thread.sleep(1000);
        System.out.println("我是主线程，我也要来");
        lock(2);
    }

    private static synchronized void lock(int count) {
        if (count == 0) {
            return;
        }
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println(Thread.currentThread().getName() + " " + count);
        lock(count - 1);
    }

}

/* 输出:

Thread-0 5
我是主线程，我也要来
Thread-0 4
Thread-0 3
Thread-0 2
Thread-0 1
main 2
main 1

*/
```

### 可重入锁 ReentrantLock

ReentrantLock是Java中很常见的工具类， 从名字就可以看出，它是个可重入锁，用法也很简单：

```java
import java.util.concurrent.locks.ReentrantLock;

public class Main {

    public static void main(String[] args) throws Exception {
        // 构造函数可传入一个布尔，表示是否使用公平锁(公平锁是什么？请听下回分解)
        ReentrantLock lock = new ReentrantLock(false);
        new Thread(() -> {
            lock.lock();
            System.out.println("A 获取了锁");
            try {
                Thread.sleep(10000);
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
            System.out.println("A 释放了锁");
            lock.unlock();
        }).start();
        new Thread(() -> {
            System.out.println("B 等待锁");
            lock.lock();
            System.out.println("B 获取了锁");
            lock.unlock();
            System.out.println("B 释放了锁");
        }).start();
    }

}

/* 输出:

A 获取了锁
B 等待锁
A 释放了锁
B 获取了锁
B 释放了锁

*/
```
