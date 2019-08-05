---
title: 探索JAVA并发 - 如何减少锁的竞争
date: 2019-08-04 23:20:00
tags:
 - 线程
 - 并发
 - 锁
categories: 并发编程
---

> 锁的竞争会限制代码的可伸缩性，在并发编程时通过一些手段有意地减少锁竞争，可以让程序有更好的表现。

所谓可伸缩性，即当增加计算资源(如CPU、内存、带宽等)时，程序的吞吐量或处理能力会相应增加。这个时候，我们当然希望增加的效果越明显越好，不过如果锁竞争太严重，可伸缩性会大打折扣。

## 缩小锁的范围

当某个方法需要操作一个线程不安全的共享资源时，最简单的办法就是给方法加上synchronized，这样一来这个方法只能同时有一个线程在执行，满满的安全感。

```java
public class Counter {

    private volatile int value;

    public synchronized void incr(int n) {
        System.out.println("i will incr " + n);
        try {
            // 这个小小的睡眠代表一些线程安全的操作
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("i am ready");
        value = value + n;
        System.out.println("i incr " + n);
    }

    //...
}
```

上述示例的同步方法中有个耗时1秒的准备过程，这个过程是线程安全，但由于身在同步方法中，众线程不得不排队睡觉。这时候不管增加多少个线程，程序该睡多久还是睡多久。若是把这个步骤从同步代码块中移除，大家就能并发睡觉。

```java
public class Counter {

    private volatile int value;

    public void incr(int n) {
        System.out.println("i will incr " + n);
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("i am ready");
        synchronized (this) {
            // 只有这行代码是不能并发执行的
            value = value + n;
        }
        System.out.println("i incr " + n);
    }

    //...
}
```

通过上述示例就让线程在持有锁时需要执行的指令尽可能小，并发的效率更高了。

但如果多个线程不安全的操作之间隔着一些安全的耗时操作，是分别使用同步块，还是用一个同步块，并不能说谁一定好。因为同步代码块也是有额外性能开销的，比起同步执行无关的操作，不一定划算，还是需要通过测试，用数据说话。

## 减小锁粒度 - 锁分解

如果一个锁要用来保护多个相互独立的资源，可以考虑用多个锁分别保护某个资源，即锁分解。

如此这般，就不用在只需要操作一个资源时，把其它不相干资源也卷入其中，导致其它想用资源的线程看着这个线程占着茅坑不拉💩（或者占着整个厕所更恰当？）。

### 使用一个锁保护多个资源

下面这个示例，不管想操作哪个资源，都会把所有资源都锁住。

```java
public class Counter {

    private volatile int src1;
    private volatile int src2;
    private volatile int src3;

    public synchronized void incr(int src1, int src2, int src3) {
        this.src1 += src1;
        this.src2 += src2;
        this.src3 += src3;
    }
}
```

### 一个锁保护一个资源

通过锁分解，每个资源有它自己的锁，可以单独操作。如果想兼容旧代码也是可以的。

```java
public class Counter {

    private volatile int src1;
    private volatile int src2;
    private volatile int src3;

    // 兼容旧代码，不用修改调用的地方
    public void incr(int src1, int src2, int src3) {
        if (src1 != 0) {
            incrSrc1(src1);
        }
        if (src2 != 0) {
            incrSrc2(src2);
        }
        if (src3 != 0) {
            incrSrc3(src3);
        }
    }

    public synchronized void incrSrc1(int n) {
        this.src1 += n;
    }

    public synchronized void incrSrc2(int n) {
        this.src2 += n;
    }

    public synchronized void incrSrc3(int n) {
        this.src3 += n;
    }
}
```

## 减小锁粒度 - 锁分段

锁分段是锁分解的进一步扩展，对于一组资源集合，可以把资源分为多个小组，每个小组用一个锁来保护，比如我们熟知的ConcurrentHashMap(java8中已经不再使用分段锁了，改为synchronized + cas)。

用的java8，不能分析一波ConcurrentHashMap的分段锁了，写个例子。

```java
public class Counter {

    private int[] src;

    private Object[] locks;

    /**
     * @param nSrc   资源数量
     * @param nLocks 分成几段锁
     */
    public Counter(int nSrc, int nLocks) {
        src = new int[nSrc];
        locks = new Object[nLocks];
        for (int i = 0; i < nLocks; i++) {
            locks[i] = new Object();
        }
    }

    /**
     * @param idx 要访问的资源序号
     * @param n   增量
     */
    public void incr(int idx, int n) {
        // 根据一定规则（比如hash）找到目标资源归谁管
        synchronized (locks[idx % locks.length]) {
            src[idx] += n;
        }
    }

    //...
}
```

## 避免热点域

上面的例子通过锁分段减小了锁的竞争，因为访问不同段的资源时，需要的锁是不同的，竞争压力也随之减小。毕竟比起10个人竞争一个名额，10个人竞争5个名额的话大家冲突不会那么大。

但是，依然会存在需要同时访问多个资源的情况，比如计算当前所有资源的总和，这个时候锁的粒度就很难降低了。当锁的粒度无法降低时，为了减少等待的时间，机智的程序员往往会用一些优化措施，比如把计算的结果缓存起来，热点域就随之被引入了。

依然以上面的代码为例，增加一个计数器来记录资源的变化，每个资源变化都修改计数器，这样当需要统计所有资源时，只需要返回计数器的值就行了。这个计数器就是一个热点域。

### 全局计数器引入热点域

```java
public class Counter {

    private int[] src;

    private Object[] locks;

    // 全局计数器
    private volatile int count;

    /**
     * @param nSrc   资源数量
     * @param nLocks 分成几段锁
     */
    public Counter(int nSrc, int nLocks) {
        src = new int[nSrc];
        locks = new Object[nLocks];
        for (int i = 0; i < nLocks; i++) {
            locks[i] = new Object();
        }
    }

    /**
     * @param idx 要访问的资源序号
     * @param n   增量
     */
    public void incr(int idx, int n) {
        // 根据一定规则（比如hash）找到目标资源归谁管
        synchronized (locks[idx % locks.length]) {
            src[idx] += n;
        }
        // 不管操作哪个分段的资源，计数时都竞争同一个锁
        synchronized (this) {
            count++;
        }
    }

    // 直接返回缓存的值
    public int count() {
        return count;
    }
    
    //...
}
```

### 分段计数器避免热点域

上述通过全局计数器缓存计算的结果虽然让获取计数方法的开销从O(n)变成了O(1)，但却引入了热点域，每次访问资源都要访问同一个计数器，这时候对可伸缩性就产生了一定影响，因为不管怎么增加并发资源，在访问计数器时都会有竞争。

ConcurrentHashMap中的做法是为每段数据单独维护一个计数器，然后获取总数时再对所有分段的计数做一个累加（真实情况会更复杂，比如ConcurrentHashMap会计算两次modCount并比较，如果不相等表示计算过程有变动，就会给所有分段加锁再累加）。

对全局计数器的例子做了简单的改写，去掉了热点域。但换个角度，这样却也让获取总数的方法性能受到了影响，因此实际操作时还需要根据业务场景权衡利弊。鱼和熊掌不可兼得，虽然很想说我全都要。

```java
public class Counter {

    private int[] src;

    private Lock[] locks;

    /**
     * @param nSrc   资源数量
     * @param nLocks 分成几段锁
     */
    public Counter(int nSrc, int nLocks) {
        src = new int[nSrc];
        locks = new Lock[nLocks];
        for (int i = 0; i < nLocks; i++) {
            locks[i] = new Lock();
        }
    }

    /**
     * @param idx 要访问的资源序号
     * @param n   增量
     */
    public void incr(int idx, int n) {
        // 根据一定规则（比如hash）找到目标资源归谁管
        int lockIdx = idx % locks.length;
        synchronized (locks[lockIdx]) {
            src[idx] += n;
            locks[lockIdx].count++;
        }
    }

    public int count() {
        // 就不像ConcurrentHashMap那么严谨了，意思一下
        int sum = 0;
        for (Lock lock : locks) {
            sum += lock.count;
        }
        return sum;
    }

    // 锁
    private static class Lock {
        volatile int count;
    }

    //...
}
```

## 替代独占锁

有时候可以选择放弃使用独占锁，改用更加友好的并发方式。

### 读写锁

> 读写锁(ReentrantReadWriteLock)维护了一对锁（一个读锁和一个写锁），通过分离读锁和写锁，使得并发性相比一般的排他锁有了很大提升。

在读比写多的场景下，使用读写锁往往比一般的独占锁有更好的性能表现。

### 原子变量

> 原子变量可以降低热点域的更新开销，但无法消除。

java.util.concurrent.atomic.* 包下有一些对应基本类型的原子变量类，使用了操作系统底层的能力，使用CAS(比较并交换，compare-and-swap)更新值。

## 检测CPU利用率

通过检测CPU的利用率，分析出可能限制程序性能的点，做出相应措施。

### CPU利用率不均匀

多核的机器上，如果某个CPU忙成🐶，其它CPU就在旁边喊666，那证明当前程序的的大部分计算工作都由一小组线程在做。这时候可以考虑把这部分工作多拆分几个线程来做（比如参考CPU数）。

![一人干活多人围观](/img/emoji/一人干活多人围观.jpeg) 

### CPU利用不充分

和CPU利用率不均匀的区别在于，他可能是均匀的，就是大家都在磨洋工。

![磨洋工](/img/emoji/磨洋工.gif) 

CPU利用不充分一般有一下几个原因：

+ 负载不均衡：僧多粥少，一人能分点事做就不错了。这种情况可以考虑增加工作量，不要怜惜它们；
+ I/O密集：程序就不是CPU密集型的，这种情况可以想办法增加I/O效率（比如增加任务/并发、提高带宽），以此来使CPU利用率得到一定提高；
+ 外部依赖限制：比如调用其它服务等待太久，瓶颈在别人那。可以像I/O密集那样自我提升，实力足够的话也可以改变别人；
+ 锁竞争：本文探索的主题，可以在线程转储信息中寻找等待锁的地方，因地制宜。

### CPU忙碌

> 闲也不行，忙也不行，你还要我怎样？要怎样！

如果CPU们已经很忙了，证明工作还是很饱和的，如果还想提高效率，可以考虑加派CPU了。不过并不是增加了CPU效率就一定会提升，增加CPU后可能又会变成上面两种情况，这是一个循环，当循环停止（无法通过上面的方式得到有效优化），我们的应用基本上达到一个所谓“极限”了。

## 不使用对象池

线程池的应用范围很广，比如各种连接池。当应用创建比较耗时、耗资源时也常用对象池技术。但有时候，高并发下操作对象池带来的性能损耗（线程同步、锁竞争、阻塞...）可能比起在需要的时候直接new一直对象更大。

> 通常，对象分配操作的开销比线程同步的开销更低。

## 总结

总的来说有3种方式可以降低锁的竞争程度，上面的操作基本都是围绕这3种方式来做的：

1. 减少锁的持有时间（如：缩小锁范围）
2. 降低锁的请求频率（如：锁分解，锁分段）
3. 使用带有协调机制的独占锁（如：分段锁，读写锁）

> 参考书籍: 《Java并发编程实战》