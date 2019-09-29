---
title: 探索JAVA并发 - synchronized和ReentrantLock如何选择
date: 0000-01-01 00:00:00
tags:
 - 线程
 - 并发
 - 锁
categories: 并发编程
---

> synchronized、ReentrantLock，我该为谁转身？

两者的区别：

+ synchronized：内置锁，即JVM的内置属性，在虚拟机层面实现了对锁的支持
+ ReentrantLock：Lock接口的一种实现，即通过代码实现了锁的语义

## synchronized

synchronized作为java中的一个关键字，可以用来修饰的对象如下：

1. 代码块：花括号{}包起来的代码处于同步状态，需要指定一个对象作为“锁”
2. 成员方法：该对象整个方法处于同步状态，不同对象直接不会阻塞（类似于当前对象做为锁）
3. 静态方法：该类整个方法处于同步状态（类似于当前类做为锁）

举栗

### synchronized修饰代码块

```java
Object obj=new Object();
synchronized (obj){
    //用一个obj作为一个锁
}

synchronized (Object.class){
    //用一个类作为锁，当然类也是一个对象
}
```

### synchronized修饰成员方法

下面的例子，两个线程能同时执行成员方法，因为调用的是不同的对象。

```java
public class SyncBoy {
    private String name;

    public SyncBoy(String name) {
        this.name = name;
    }

    public synchronized void 成员方法() {
        System.out.println(Thread.currentThread().getName() + " 进入了 " + name + " 的 成员方法");
        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println(Thread.currentThread().getName() + " 离开了 " + name + " 的 成员方法");
    }

    public static void main(String[] args) {
        SyncBoy boy1 = new SyncBoy("小蔡");
        SyncBoy boy2 = new SyncBoy("阿坤");
        new Thread(() -> {
            boy1.成员方法();
        }).start();
        new Thread(() -> {
            boy2.成员方法();
        }).start();
    }
}
/* 输出:

Thread-0 进入了 小蔡 的 成员方法
Thread-1 进入了 阿坤 的 成员方法
Thread-0 离开了 小蔡 的 成员方法
Thread-1 离开了 阿坤 的 成员方法

*/
```

### synchronized静态成员方法

修饰静态方法时，就算是通过不同的对象调用也不能同时执行，因为作为锁的对象是那个类，不是小蔡，也不是阿坤。

```java
public class SyncBoy {
    private String name;

    public SyncBoy(String name) {
        this.name = name;
    }

    public static synchronized void 静态方法() {
        System.out.println(Thread.currentThread().getName() + " 进入了 静态方法");
        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println(Thread.currentThread().getName() + " 离开了 静态方法");
    }

    public static void main(String[] args) {
        SyncBoy boy1 = new SyncBoy("小蔡");
        SyncBoy boy2 = new SyncBoy("阿坤");
        new Thread(() -> {
            boy1.静态方法();
        }).start();
        new Thread(() -> {
            boy2.静态方法();
        }).start();
    }
}

/* 输出:

Thread-0 进入了 静态方法
Thread-0 离开了 静态方法
Thread-1 进入了 静态方法
Thread-1 离开了 静态方法

*/
```

### synchronized修饰代码块和修饰方法的区别

#### 1.作用域不同

synchronized修饰代码块可以更加灵活地控制同步的范围，适当调整可以减小锁竞争。[如何减少锁的竞争](/2019/08/04/concurrent-lock-contention-reduce/)

#### 2.底层区别

+ 代码块：通过在字节码中加入monitorenter、monitorexit来实现monitor的获取和释放
+ 方法：直接检查方法ACC_SYNCHRONIZED标志是否设置，需要设置了才获取monitor，执行完又释放

本质上都是获取monitor，执行，释放monitor。

反编译方法：

```
javac SyncBoy.java
javap -v SyncBoy 
```

### synchronized的优化

jvm针对synchronized有一中优化，使其在不同的场景下可以尽可能有好的性能表现。

#### 锁膨胀

#### 锁粗化

#### 锁消除

#### 偏向锁

#### 轻量级锁

#### 重量级锁

#### 自旋锁

#### 适应性自旋锁

## ReentrantLock

