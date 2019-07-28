---
title: 探索JAVA并发 - 如何处理线程中断
date: 2019-07-25 22:40:00
tags:
 - 线程
categories: 并发编程
---

> 中断是一种协作机制，通过这种机制可以要求指定线程在可以暂停的地方停止当前任务，但这个要求可以无视，我们也经常这么做（虽然不好），那应该这么对待其它线程发来的中断要求呢？

在上一篇[如何优雅地取消线程任务](/2019/07/24/concurrent-thread-cancel/)中提到了通过中断可以取消线程正在进行的任务，现在针对中断这件事情再来简单聊聊。

## 阻塞库如何抛出中断

JAVA中有很多带阻塞方法的工具类，这种方法往往会声明一个受检查的异常InterruptedException，如果被中断，它会尝试提前结束阻塞状态，并抛给调用者一个InterruptedException异常，让对方决定何去何从。

用ArrayBlockingQueue.offer(E, long, TimeUnit)为例。

```java
public class ArrayBlockingQueue<E> extends AbstractQueue<E>
        implements BlockingQueue<E>, java.io.Serializable {

    public boolean offer(E e, long timeout, TimeUnit unit)
        throws InterruptedException {

        checkNotNull(e);
        long nanos = unit.toNanos(timeout);
        final ReentrantLock lock = this.lock;
        // 这里可能抛出中断异常：
        // 获取锁时如果线程已中断 or 等待锁时线程被中断
        lock.lockInterruptibly();
        try {
            while (count == items.length) {
                if (nanos <= 0)
                    return false;
                // 这里可能抛出中断异常：如果当前线程被中断
                nanos = notFull.awaitNanos(nanos);
            }
            enqueue(e);
            return true;
        } finally {
            lock.unlock();
        }
    }
}
```

## 传递中断

如果捕获到一个中断异常不知道怎么处理它，那么可以考虑把这个烫手山芋扔出去，扔给你的上级（调用者），即传递中断。

### 传递方式1: 不捕获中断异常

只要在方法上添加一个InterruptedException的声明，就能轻松把这个锅甩给调用者，因为此时你也成为了可中断大军的一员。既然解决不了，那就加入。

```java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

public class Main {

    public static void main(String[] args) throws InterruptedException {
        ArrayBlockingQueue<Object> queue = new ArrayBlockingQueue<>(100);
        queue.offer(new Object(), 1L, TimeUnit.MINUTES);
    }
}
```

### 传递方式2: 捕获再抛出

如果希望发生中断时自己可以做点扫尾操作，那么可以捕获中断异常，做点小动作后再抛出这个异常（你也可以抛出其它自定义异常）。

```java
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

public class Main {

    public static void main(String[] args) throws InterruptedException {
        ArrayBlockingQueue<Object> queue = new ArrayBlockingQueue<>(100);
        try {
            queue.offer(new Object(), 1L, TimeUnit.MINUTES);
        } catch (InterruptedException e) {
            System.out.println("有人想中断我，我从了");
            throw e;
        }
    }
}
```

## 恢复中断

当我们捕获到中断异常的时候，如果再去调用Thread.isInterrupted()往往得到的是false，因为这件事只有一个人来处理就够了，所以抛出异常后会清除中断状态，比如Thread,sleep()。

```java
public class Thread implements Runnable {
    /**
     * 强行翻译: 算了不翻译了，上篇写过
     * @throws  InterruptedException
     *          if any thread has interrupted the current thread. The
     *          <i>interrupted status</i> of the current thread is
     *          cleared when this exception is thrown.
     */
    public static native void sleep(long millis) throws InterruptedException;
```

因此，线程不方便抛出异常的时候（比如在实现Runnable，我们知道run()方法没有声明异常），我们可以捕获到中断异常后再次把线程状态置为中断。这件事我管不了， 谁爱管谁管。

```java

public class Main {

    public static void main(String[] args) throws InterruptedException {
        Thread thread = new Thread() {
            @Override
            public void run() {
                while (true) {
                    try {
                        System.out.println("可有人想中断我？" + isInterrupted());
                        sleep(1000);
                    } catch (InterruptedException e) {
                        System.out.println("有人想中断我，我拒绝");
                        System.out.println(isInterrupted());
                        interrupt();
                    }
                }
            }
        };
        thread.start();
        Thread.sleep(3000);
        thread.interrupt();
    }

}

/* 输出

可有人想中断我？false
可有人想中断我？false
可有人想中断我？false   // 虽然下一步就捕获到中断，但这里依然是false，证明是在sleep时才被中断的
有人想中断我，我拒绝
false                // 捕获到异常后，当前线程状态是“非中断”，但被我设为中断了
可有人想中断我？true    // 因为已经被我设为中断了
有人想中断我，我拒绝    // 那人就是你自己啊
false               // 无限模式启动
可有人想中断我？true
有人想中断我，我拒绝
false

(略...)

*/
```

## 总结

1. 线程处于中断状态表明有人想让它赶紧结束，但得到这个信号的线程可以做出自己的选择；
2. 不要捕获到它却冷漠的不做任何响应（可以不爱，莫要伤害）。