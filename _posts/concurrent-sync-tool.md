---
title: 探索JAVA并发 - 同步工具类
date: 2019-07-23 22:00:00
tags:
 - 线程
 - 并发
 - 同步
categories: 并发编程
---

> 同步工具类是个笼统的概念，它可以根据自身状态来协调线程的控制流，了解JAVA中常用的同步工具能帮助开发者写出更好的并发代码。

## 闭锁 CountDownLatch

闭锁的作用相当于一扇门，在这扇门没打开前，任何线程执行到这里都会被无情扣押，直到有人打开了这扇门，那些阻塞在门外的线程才会继续进行门后的流程。

```java
import java.util.concurrent.CountDownLatch;

public class Main {

    public static void main(String[] args) throws InterruptedException {
        //第一扇门，需要1次触发即可打开
        CountDownLatch firstDoor = new CountDownLatch(1);
        //第二扇门，需要3次触发才可打开
        CountDownLatch lastDoor = new CountDownLatch(3);
        //启动3个线程
        for (int i = 1; i <= 3; i++) {
            int id = i;
            new Thread(() -> {
                try {
                    System.out.println(id + "号靓仔到达第一扇门前");
                    firstDoor.await();
                    Thread.sleep((long) (Math.random() * 5000));//随机休息一会
                    System.out.println(id + "号靓仔到达第二扇门前并触发");
                    lastDoor.countDown();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }).start();
        }
        Thread.sleep(1000);
        //主线程打开第一扇门，让其他线程可以通过
        firstDoor.countDown();
        //等待其他线程合力打开第二扇门
        lastDoor.await();
        System.out.println("bye~");
    }
}

/* 输出:

1号靓仔到达第一扇门前
3号靓仔到达第一扇门前
2号靓仔到达第一扇门前
1号靓仔到达第二扇门前并触发
2号靓仔到达第二扇门前并触发
3号靓仔到达第二扇门前并触发
bye~

*/
```


## 闭锁 FutureTask

FutureTask也可以用作闭锁，常与线程池一起使用，提交到线程池后，主线程（提交任务的线程）调用get()方法阻塞线程直到异步任务执行完毕或超时。

```java
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;

public class Main {

    public static void main(String[] args) throws InterruptedException, ExecutionException {
        // 方式1：传入一个Callable，即业务代码执行完直接return
        FutureTask<Liangzai> callableTask = new FutureTask<>(new Callable<Liangzai>() {
            @Override
            public Liangzai call() throws Exception {
                Thread.sleep(1000);
                Liangzai liangzai = new Liangzai();
                liangzai.name = "callable";
                return liangzai;
            }
        });

        // 方式2：传入一个runnable和一个存储结果的对象，在runnable中修改结果对象
        Liangzai runableLiangzai = new Liangzai();
        FutureTask<Liangzai> runableTask = new FutureTask<>(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(1000);
                    runableLiangzai.name = "runable";
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }
        }, runableLiangzai);

        // 异步给靓仔取名
        new Thread(callableTask).start();
        // 等待名字确定完毕
        Liangzai liangzai = callableTask.get();
        System.out.println(liangzai);

        // 异步给靓仔取名
        new Thread(runableTask).start();
        // 等待名字确定完毕
        liangzai = runableTask.get();
        System.out.println(liangzai);

    }

    public static class Liangzai {

        String name;

        @Override
        public String toString() {
            return "Liangzai{" +
                    "name='" + name + '\'' +
                    '}';
        }
    }
}

/* 输出:

Liangzai{name='callable'}
Liangzai{name='runable'}

*/
```

## 信号量 Semaphore

信号量用来控制同时“访问资源”或“执行操作”的线程数量，也可以用来实现资源池等。它管理着一组虚拟的“许可”，每当线程想访问某个特殊资源，需要先向它申请一个许可，用完后再返还许可，许可不足时将阻塞。

```java
import java.util.concurrent.*;

public class Main {

    public static void main(String[] args) throws InterruptedException, ExecutionException {
        // 初始化2个许可
        Semaphore semaphore = new Semaphore(2);

        // 不想用线程池，用这个实现主线程等待所有子线程执行完毕
        int n = 10;
        CountDownLatch countDownLatch = new CountDownLatch(n);
        for (int i = 1; i <= n; i++) {
            int id = i;
            new Thread(() -> {
                try {
                    // 申请一个许可
                    System.out.println(id + "号想要1个许可");
                    semaphore.acquire();
                    System.out.println(id + "号得到1个许可");

                    // 持有许可一段时间
                    Thread.sleep((long) (Math.random() * 10000));

                    // 归还许可
                    semaphore.release();
                    System.out.println(id + "号归还1个许可");

                    // 此线程完毕
                    countDownLatch.countDown();
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }).start();
        }
        countDownLatch.await();
        System.out.println("done~");
    }
}

/* 输出:

1号想要1个许可
2号想要1个许可
1号得到1个许可
2号得到1个许可
3号想要1个许可
4号想要1个许可
5号想要1个许可
6号想要1个许可
7号想要1个许可
8号想要1个许可
9号想要1个许可
10号想要1个许可
2号归还1个许可
3号得到1个许可
1号归还1个许可
4号得到1个许可
3号归还1个许可
5号得到1个许可
4号归还1个许可
6号得到1个许可
5号归还1个许可
7号得到1个许可
6号归还1个许可
8号得到1个许可
7号归还1个许可
9号得到1个许可
9号归还1个许可
10号得到1个许可
10号归还1个许可
8号归还1个许可
done~

*/
```

上面的代码，由于只有两个许可，所有前两个线程一说想要马上就得到了，第三个开始就开始了不算漫长的等待，下一次有线程得到许可是在有一个线程归还许可之后。

## 栅栏 CyclicBarrier

CyclicBarrier类似于CountDownLatch，也是阻塞一组线程直到某个时间点，区别如下。

+ 闭锁 CountDownLatch：等待一组线程全部完成某个任务，然后等待线程继续执行后续动作。结束后状态不会再改变
+ 栅栏 CyclicBarrier：等待一组线程全部到达某个位置，然后该组线程继续执行后续动作，该组线程互相等待。状态可以重置。

```java
import java.util.concurrent.*;

public class Main {

    public static void main(String[] args) throws InterruptedException, ExecutionException {
        // 定义一个栅栏，等待3个人到达后一起嗨皮
        int n = 3;
        CyclicBarrier barrier = new CyclicBarrier(n, new Runnable() {
            @Override
            public void run() {
                // 全部人就绪后执行的操作
                System.out.println("大家都到齐了，开始happy去");
            }
        });

        // 不想用线程池，用这个实现主线程等待所有子线程执行完毕
        CountDownLatch countDownLatch = new CountDownLatch(n);
        for (int i = 1; i <= n; i++) {
            int id = i;
            new Thread(() -> {
                try {
                    // 每个人出门打扮需要的时间都是不同的
                    Thread.sleep((long) (Math.random() * 5000));

                    // 等待其他人到达这里
                    System.out.println(id + ": 我到地方了");
                    barrier.await();
                    System.out.println(id + ": let's go");

                    // 此线程完毕
                    countDownLatch.countDown();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }).start();
        }
        countDownLatch.await();
        System.out.println("done~");
    }
}

/* 输出:

3: 我到地方了
2: 我到地方了
1: 我到地方了
大家都到齐了，开始happy去
1: let's go
3: let's go
2: let's go
done~

*/
```

## 栅栏 Exchanger

Exchanger是一种两方的栅栏，用于两方之间交换数据，一方发出消息后会阻塞直到对方接受到消息并返回一个消息，达到一人一句的和谐交流。当两方的操作不对称时很有用，比如一个线程往缓冲区写数据，一个线程从缓冲区读数据。

```java
import java.util.concurrent.*;

public class Main {

    public static void main(String[] args) throws InterruptedException, ExecutionException {
        Exchanger<String> exchanger = new Exchanger<>();
        CountDownLatch countDownLatch = new CountDownLatch(2);
        new Thread(() -> {
            try {
                for (int i = 0; i < 5; i++) {
                    Thread.sleep((long) (Math.random() * 5000));
                    String fromKun = exchanger.exchange("我是小菜，No." + i);
                    System.out.println("小菜收到消息：" + fromKun);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            countDownLatch.countDown();
        }).start();
        new Thread(() -> {
            try {
                for (int i = 0; i < 5; i++) {
                    Thread.sleep((long) (Math.random() * 5000));
                    String fromKun = exchanger.exchange("我是阿坤，No." + i);
                    System.out.println("阿坤收到消息：" + fromKun);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            countDownLatch.countDown();
        }).start();
        countDownLatch.await();
        System.out.println("done~");
    }
}

/* 输出:

小菜收到消息：我是阿坤，No.0
阿坤收到消息：我是小菜，No.0
阿坤收到消息：我是小菜，No.1
小菜收到消息：我是阿坤，No.1
阿坤收到消息：我是小菜，No.2
小菜收到消息：我是阿坤，No.2
小菜收到消息：我是阿坤，No.3
阿坤收到消息：我是小菜，No.3
阿坤收到消息：我是小菜，No.4
小菜收到消息：我是阿坤，No.4
done~

*/
```

## 总结

所谓同步工具类并不特指实现某种功能的类，它们主要的价值就在于能帮助多线程之间更好地相互配合完成工作，只要对自己的需求清晰，对JAVA自带的类熟悉，就能选择合适的同步工具类，甚至实现自己需要的同步工具类。