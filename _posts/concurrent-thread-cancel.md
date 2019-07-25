---
title: 探索JAVA并发 - 如何优雅地取消线程任务
date: 2019-07-24 22:00:00
tags:
 - 线程
categories: 并发编程
---

> 通过线程启动一个异步的任务很容易，但想让它提前安全且快速地结束确并不简单。如果线程外部的代码可以提前把目标线程置为“完成”状态，那么这个目标线程就是可取消的。

线程任务取消的原因一般有如下几种：

+ 用户请求取消: 比如用户发起一个耗时操作后，不想等了，就点击了取消按钮，此时我们应该把还在执行的任务叫停；
+ 时间限制: 某些流程可能很费时，我们要控制等待时间，当超时后需要取消掉任务；
+ 程序事件: 某些线程之间可能正在配合完成某项工作，其中一个达到目标后告诉其它同事可以提前下班了；
+ 系统异常: 如果由于依赖的服务或资源发生异常，导致工作干不下去了，那么可以提前取消；
+ 程序关闭: 比如系统要重启，那么还在进行的任务应该取消。

## 取消标志

一种常用的方法是在任务代码中加入一个“是否取消”的标志，任务定期去查看这个标志是否改变，如果被改变了就取消剩下的任务，此时如果想取消这个任务只需要修改它的标志，然后安静地等待其退出即可。

```java
public class Main {

    public static void main(String[] args) throws InterruptedException {
        Worker worker = new Worker();
        worker.start();
        Thread.sleep(3000);
        worker.cancel();
    }

    public static class Worker extends Thread {

        private volatile boolean cancelled;

        @Override
        public void run() {
            while (!cancelled) {
                System.out.println("搬砖五分钟，划水两小时");
                try {
                    sleep(1000);
                } catch (InterruptedException e) {
                    // 注意这里，后面会提到
                    e.printStackTrace();
                }
            }
            System.out.println("溜了溜了");
        }

        /**
         * 取消任务
         */
        public void cancel() {
            cancelled = true;
        }
    }

}

/* 输出:

搬砖五分钟，划水两小时
搬砖五分钟，划水两小时
搬砖五分钟，划水两小时
溜了溜了

*/
```

这种方式最为简单，而且非常安全，因为我们可以自己在代码中控制什么时候可以取消（如示例中每次执行一个循环都可以取消）。

+ 缺点：调用取消的方法后线程并不能保证很快就退出，这取决于一个循环的执行速度，更可怕的是，如果里面有个阻塞操作，它可能永远无法退出。
+ 解决：对于阻塞操作设置超时等待，防止永远阻塞。

## 中断

线程中断是一种协作机制，通过这个机制通知某个线程，让它可以在合适的或可能的情况下停止任务。那么什么是合适/可能的情况呢？

线程有个“interrupted”（被打断/中断）的状态，通过Thread的以下方法可以查看/修改这个状态

```java
public class Thread implements Runnable {

    // 中断目标线程
    public void interrupt() {
        //...
    }

    // 返回是否中断
    public boolean isInterrupted() {
        return isInterrupted(false);
    }

    // 清除中断状态，并返回在此之前是否中断
    // 如果返回true，证明有人想中断这个线程，你需要正式这个问题:
    // 1.无视这个人的请求
    // 2.帮他继续这个请求(再次调用interrupt恢复为中断状态)
    // 3.其它处理方式
    // PS: 注意这是个static方法
    public static boolean interrupted() {
        return currentThread().isInterrupted(true);
    }

    // 返回是否中断，参数为是否清除中断状态
    private native boolean isInterrupted(boolean ClearInterrupted);
}
```

> 调用中断方法 interrupt() 并不会让目标线程立即停止任务，只是传递一个“可以停止”的信息给它。


当线程调用wait、sleep、join等会抛出InterruptedException的方法时，就是可以响应中断信号的时刻（因此这些时刻也被称为取消点）

```java
public class Thread implements Runnable {

    /**
     * 学渣强行翻译：
     * 如果任意线程中断了当前线程就会抛出此异常；
     * 这个异常抛出后当前线程的“中断”状态会被清空，即捕获异常后再调用isInterrupted()返回false
     * @throws  InterruptedException
     *          if any thread has interrupted the current thread. The
     *          <i>interrupted status</i> of the current thread is
     *          cleared when this exception is thrown.
     */
    public static native void sleep(long millis) throws InterruptedException;
}
```

因此我们可以在程序中适当使用“取消点”方法，并对中断异常进行处理，回到上面的代码，线程每次输出一句话后都会sleep一秒，针对sleep方法抛出的异常，线程补捕获到后并没有做任何处理，而是把它吃了，现在我要充分利用它。

```java

public class Main {

    public static void main(String[] args) throws InterruptedException {
        Worker worker = new Worker();
        worker.start();
        Thread.sleep(3000);
        worker.interrupt();
    }

    public static class Worker extends Thread {

        private volatile boolean cancelled;

        @Override
        public void run() {
            while (!cancelled) {
                System.out.println("搬砖五分钟，划水两小时");
                try {
                    sleep(1000);
                } catch (InterruptedException e) {
                    System.out.println("老板让我提前下班咯");
                    break;
                }
            }
            System.out.println("溜了溜了");
        }

        /**
         * 取消任务
         */
        public void cancel() {
            cancelled = true;
        }
    }

}

/* 输出: 

搬砖五分钟，划水两小时
搬砖五分钟，划水两小时
搬砖五分钟，划水两小时
老板让我提前下班咯
溜了溜了

*/
```

使用了中断，我们的程序似乎提升了些许逼格，但阻塞操作带来的问题依然没有解决。不过我们还是建议使用中断来取消线程，甚至说通常情况下，中断是实现取消的最合理方式。

为什么这么说，因为很多包含阻塞操作的库函数实现了和中断机制的交互，简单说就是很多阻塞操作本身就会抛出InterruptedException异常。

举个例子，阻塞队列，它的阻塞方法定义了抛出异常InterruptedException，通过注释知道在等待时如果被中断了就会抛出这个异常。

```java
public interface BlockingQueue<E> extends Queue<E> {

    /**
     * (去掉无关注释)
     *
     * Inserts the specified element into this queue, waiting up to the
     * specified wait time if necessary for space to become available.
     *
     * @throws InterruptedException if interrupted while waiting
     */
    boolean offer(E e, long timeout, TimeUnit unit)
        throws InterruptedException;
}
```

让我们善用线程中断机制吧~