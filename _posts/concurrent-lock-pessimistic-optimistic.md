---
title: 探索JAVA并发 - 悲观锁和乐观锁
date: 2019-08-10 12:30:00
tags:
 - 并发
 - 锁
categories: 并发编程
---

> 什么是悲观锁，什么是乐观锁，它们是如何实现的？

## 定义

+ 悲观锁：对世界充满不信任，认为一定会发生冲突，因此在使用资源前先将其锁住，具有强烈的独占和排他特性。
+ 乐观锁：相信世界是和谐的，认为接下来的操作不会和别人发生冲突，因此不会上锁，直接进行计算，但在更新时还是会判断下这期间是否有人更新过(该有的谨慎还是不能少)，再决定是重新计算还是更新。

## 悲观锁

悲观锁认为一定会有人和它同时访问目标资源，因此必须先将其锁定，常见的synchronized和ReentrantLock等独占锁就是悲观锁思想的实现。

举个简单的例子感受一下:

```java
import java.util.concurrent.atomic.AtomicInteger;

public class Main {

    // java提供的一个可以进行原子操作的类，对它进行加减不会受多线程影响
    // 虽然这里实际上用不到
    private static AtomicInteger count = new AtomicInteger();

    public static void main(String[] args) throws Exception {
        for (int i = 0; i < 5; i++) {
            new Thread(() -> {
                while (true) {
                    System.out.println(Thread.currentThread().getName() + " waiting");
                    visit();
                }

            }).start();
        }
    }

    private static synchronized void visit() {
        System.out.println(Thread.currentThread().getName()
                + " is coming, count = " + count.incrementAndGet());
        try {
            Thread.sleep((long) (Math.random() * 5000));
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        count.decrementAndGet();
    }

}

/* 输出:

Thread-0 waiting
Thread-0 is coming, count = 1
Thread-1 waiting
Thread-2 waiting
Thread-3 waiting
Thread-4 waiting
Thread-0 waiting
Thread-4 is coming, count = 1
Thread-4 waiting
Thread-3 is coming, count = 1
Thread-3 waiting
Thread-2 is coming, count = 1
Thread-2 waiting
Thread-1 is coming, count = 1
Thread-2 is coming, count = 1
Thread-1 waiting
Thread-2 waiting
Thread-3 is coming, count = 1
Thread-3 waiting
Thread-4 is coming, count = 1
Thread-4 waiting
Thread-0 is coming, count = 1
Thread-0 waiting
Thread-4 is coming, count = 1

*/
```

从输出可以看到，每次有线程访问这个资源(方法)时，count都是1，也就是说只有一个线程在访问它，这个线程在访问前先锁定了资源，导致其他线程只能等待。

## 乐观锁

乐观锁总是假设会遇到最好的情况，即这个资源除了我没人感兴趣，没人和我抢。虽然理想是美好的，但现实往往是残酷的，所以也不能盲目乐观，还是需要保证并发操作时不会对资源造成错误影响。可以使用版本号机制和CAS算法实现。

### 版本号机制

常用于数据库的版本控制中，即每个数据版本有个版本号字段，每次数据被修改，版本号就会增加。

当一个操作要更新一个数据时，先读取当前版本号并记录，然后修改数据，在提交更新时检测版本号是否变化，如果没变化就应用更新，变化了就重试更新。

### CAS算法

Compare-And-Swap，比较并交换。

这种算法一般接收两个参数：预估值(expectedValue)和更新值(newValue)，返回一个布尔值（是否更新成功）。如下：

```java
boolean compareAndSwap(int expectedValue,int newValue);
```

实现逻辑为，将预估值(expectedValue)和真实值(realValue)比较，如果相同，则把真实值(realValue)修改为更新值(newValue)，返回true，否则返回false。

使用Java代码模拟CAS实现：

```java
public class CASer {

    // 真实值
    private volatile int realValue;

    // 获取当前值
    public int get() {
        return realValue;
    }

    // 自增指定值并获取自增后的值
    public synchronized int addAndGet(int increment) {
        // 不断CAS直到更新成功
        // 经常在源码中看到的是for(;;)这种写法，一种说法是两者编译出来的指令不同
        // for(;;)编译后指令更简单更快
        // 如果不是对性能很敏感随意就好，另外有的编译器可能会在编译时帮你优化成最佳指令
        while (true) {
            int expectedValue = get();
            int newValue = expectedValue + increment;
            if (compareAndSwap(expectedValue, newValue)) {
                return newValue;
            }
        }
    }

    // CAS
    // 如果当前值是expectedValue，则替换成newValue
    private synchronized boolean compareAndSwap(int expectedValue, int newValue) {
        if (expectedValue == realValue) {
            realValue = newValue;
            return true;
        }
        return false;
    }
}
```

为了模拟CAS，这里用到了synchronized关键字让方法变成同步方法，真这样用CAS也就没必要了，那么Java中是怎么实现CAS的呢？可以在原子类里找到答案。

### 基于CAS的AtomicInteger

java.util.concurrent.atomic.* 包下提供了一些基本类型的原子变量类，可以在并发场景进行原子的加减操作，它们就是用到了CAS。

从源码开始理解：

```java
public class AtomicInteger extends Number implements java.io.Serializable {
    private static final long serialVersionUID = 6214790243416807050L;

    // setup to use Unsafe.compareAndSwapInt for updates
    private static final Unsafe unsafe = Unsafe.getUnsafe();
    private static final long valueOffset;

    static {
        try {
            // 获取某个字段相对Java对象的“起始地址”的偏移量
            valueOffset = unsafe.objectFieldOffset
                (AtomicInteger.class.getDeclaredField("value"));
        } catch (Exception ex) { throw new Error(ex); }
    }

    // 使用volatile保证可见性
    private volatile int value;

    // 增加指定值，并返回增加后的值
    public final int addAndGet(int delta) {
        return unsafe.getAndAddInt(this, valueOffset, delta) + delta;
    }
```

可以看到，AtomicInteger使用volatile保证真实值的可见性，然后使用Unsafe类提供的CAS操作来更新value的值。

Unsafe类名字看上去不太好听，但它确实不太安全。

> Unsafe类是在sun.misc包下，不属于Java标准。但是很多Java的基础类库，包括一些被广泛使用的高性能开发库都是基于Unsafe类开发的，比如Netty、Cassandra、Hadoop、Kafka等。Unsafe类在提升Java运行效率，增强Java语言底层操作能力方面起了很大的作用。

> Unsafe类使Java拥有了像C语言的指针一样操作内存空间的能力，同时也带来了指针的问题。过度的使用Unsafe类会使得出错的几率变大，因此Java官方并不建议使用的，官方文档也几乎没有。

```java
public final class Unsafe {

    private static final Unsafe theUnsafe;

    // 单例模式，私有化构造方法
    private Unsafe() {
    }

    public final int getAndAddInt(Object var1, long var2, int var4) {
        int var5;
        do {
            var5 = this.getIntVolatile(var1, var2);
        } while(!this.compareAndSwapInt(var1, var2, var5, var5 + var4));

        return var5;
    }

    public native int getIntVolatile(Object var1, long var2);

    public final native boolean compareAndSwapInt(Object var1, long var2, int var4, int var5);
```

从源码中可以看出，Unsafe的CAS是通过一系列本地方法实现的。使用了硬件级别的原子操作，效率很高。

### CAS算法缺陷

#### 只能操作一个共享变量

从上面的分析可以看出，CAS只能对单个变量有效，如果有多个资源需要一起使用似乎无法实现。但实际上是有办法的，Java中提供了一个原子引用类，让我们可以以对象为目标进行原子操作，那就是AtomicReference。把多个共享资源放到一个对象中，然后通过AtomicReference包装这个对象即可。类似还有操作数组的AtomicReferenceArray。

#### 过度消耗CPU

由于CAS可能会无法更新值，那么一般是在一个循环中不断尝试知道成功，如果竞争很大，有些线程长时间循环，会导致过度消耗CPU。因此CAS更适合在读比写多的情况下使用，反之慎用。

#### ABA问题

再看看开始提到CAS时定义的方法：

```java
boolean compareAndSwap(int expectedValue,int newValue);
```

如果真实值等于expectedValue，就能肯定这期间没人操作过资源吗？显然不能，比如另一个线程先把一个数+1，然后又-1。此时虽然值没变，但它已经经历了你不知道的事。

那么ABA会造成什么恶劣影响呢？

答案是一般不会（不会我说个锤子？但我就是要说，至少面试中经常问到），只能说一般我们期望保证在操作过程中没有其它人访问过这个资源，我才会应用我这段时间的更新（乐观锁也是锁啊，当然要保证这段时间只有我在操作啊，虽然我没锁定，但原则问题不能迁就），但是ABA使我们期望落空了，我们还不能察觉。

想举个ABA造成不良影响的例子，硬是想不出来，网上也没找到喜欢的，有没有大佬留言来一个？

ABA解决方案：核心思想就是，用于判断是否更新的值不能变回用过的值，这需要业务逻辑上做一定调整。Java中的解决方案是AtomicStampedReference，一个带版本号的原子引用类，比较时不比较业务中要用的值（这个值可能又回到最初的起点），使用一个版本号，每次修改都将版本号增加，也就是前面提到的版本号机制。

## 总结

1. 悲观锁：锁定资源 -> 使用 -> 释放资源
2. 乐观锁：获取资源快照 -> 使用 -> 确定资源没改变 -> 更新
3. 悲观锁适用竞争激烈的场景，乐观锁反之
4. 乐观锁可以用 版本号机制 + CAS算法 实现