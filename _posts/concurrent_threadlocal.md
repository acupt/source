---
title: 探索JAVA并发 - ThreadLocal
date: 2019-07-22 22:00:00
tags:
 - 线程
 - 并发
categories: 并发编程
---

> 使用ThreadLocal可以维持线程封闭性，使线程中的某个值与保存值的对象关联，防止对可变的单例变量或全局变量进行共享，但使用不当也会造成内存泄漏，先了解它，再使用它​。​

## 从SimpleDateFormat说起

SimpleDateFormat是我们常用的日期格式化工具，但熟悉的朋友都知道它是线程不安全的。

### SimpleDateFormat用法

```java
public class Acuptest {

    public static void main(String[] args) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss,SSS");
        System.out.println(sdf.format(new Date()));
    }
}
```

### SimpleDateFormat线程不安全场景

上面的用法完全没有问题，但现在spring无处不在，很多类都是以bean的形式存在于spring容器被各种共享，一不小心就会写成下面这种样子。

```java
public class Acuptest {

    private SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss,SSS");

    public String format(Date date) {
        return sdf.format(date);
    }
}
```

只是这样还看不出什么问题，但既然提到了SimpleDateFormat是线程不安全的，那么就看看为什么不安全。

### SimpleDateFormat线程不安全分析

进入源码，只看关键部分。

```java
public abstract class DateFormat extends Format {

    // 一个成员变量
    protected Calendar calendar;

    // 一个抽象方法
    public abstract StringBuffer format(Date date, StringBuffer toAppendTo, FieldPosition fieldPosition);
    
    // 提供给外部使用的方法
    public final String format(Date date){
        return format(date, new StringBuffer(),
                      DontCareFieldPosition.INSTANCE).toString();
    }
}

public class SimpleDateFormat extends DateFormat {

    // 实现了父类的抽象方法
    @Override
    public StringBuffer format(Date date, StringBuffer toAppendTo, FieldPosition pos){
        pos.beginIndex = pos.endIndex = 0;
        return format(date, toAppendTo, pos.getFieldDelegate());
    }

    private StringBuffer format(Date date, StringBuffer toAppendTo, FieldDelegate delegate) {
        // 到这里就能发现问题了，竟然给成员变量设置成了传进来的参数
        // 在并发情况下calendar的值就不可信了，可能线程A前脚刚设置完准备执行下一条语句，线程B紧随其后就把值给改了
        // Convert input date to time field list
        calendar.setTime(date);

        boolean useDateFormatSymbols = useDateFormatSymbols();

        // 略
    }
}
```

### SimpleDateFormat线程安全用法

#### 使用局部变量

只要不让多线程访问同一个对象，每次要用就new一个对象即可。

#### 使用ThreadLocal

很多时候某些对象往往不适合频繁创建、销毁，但它又像SimpleDateFormat那样线程不安全。这时候ThreadLocal就有用武之地了。

```java
public class Acuptest {

    // 为每个线程单独分配一个SimpleDateFormat，线程内部可以复用，线程之间不能共享。
    private ThreadLocal<SimpleDateFormat> sdf = new ThreadLocal<SimpleDateFormat>() {
        @Override
        protected SimpleDateFormat initialValue() {
            // get()方法获取不到当前线程的SimpleDateFormat对象时，会调用此方法创建一个并绑定到线程
            return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss,SSS");
        }
    };

    public String format(Date date) {
        return sdf.get().format(date);
    }
```

## ThreadLocal源码分析

```java
public class ThreadLocal<T> {
    //...
    // 获取当前线程绑定的对象，如果没有，将调用initialValue生成一个并绑定
    public T get() {
        // 获取当前线程
        Thread t = Thread.currentThread();
        // 从当前线程中取到一个MAP
        // key: ThreadLocal
        // value: ThreadLocal的泛型 <T>
        ThreadLocalMap map = getMap(t);
        if (map != null) {
            ThreadLocalMap.Entry e = map.getEntry(this);
            if (e != null) {
                @SuppressWarnings("unchecked")
                T result = (T)e.value;
                return result;
            }
        }
        // Thread对象可能还没创建ThreadLocalMap成员变量
        // 或者ThreadLocalMap里没有当前ThreadLocal对象对应的<T>值
        // 此时需要设置初始值
        return setInitialValue();
    }

    // 获取线程里的MAP
    ThreadLocalMap getMap(Thread t) {
        return t.threadLocals;
    }

    // 设置初始值
    private T setInitialValue() {
        // 创建一个新的对象
        T value = initialValue();
        // 重新获取当前线程，因为没有参数接收线程信息
        Thread t = Thread.currentThread();
        ThreadLocalMap map = getMap(t);
        if (map != null)
            map.set(this, value); // 设置初始值
        else
            createMap(t, value); // 创建MAP并设置初始值
        return value;
    }

    // 初始化一个对象，默认返回null，可在使用时重写此方法
    protected T initialValue() {
        return null;
    }
    // ...
}
```

## Thread源码分析

上面的源码中看到ThreadLocal多次使用Thread中的成员变量threadLocals，于是对Thread对象的结构再做个简单了解。

```java
public class Thread implements Runnable {
    
    /* ThreadLocal values pertaining to this thread. This map is maintained
     * by the ThreadLocal class. */
    ThreadLocal.ThreadLocalMap threadLocals = null;

    /*
     * InheritableThreadLocal values pertaining to this thread. This map is
     * maintained by the InheritableThreadLocal class.
     */
    ThreadLocal.ThreadLocalMap inheritableThreadLocals = null;

    // 略
}

public class ThreadLocal<T> {
    
    static class ThreadLocalMap {

        static class Entry extends WeakReference<ThreadLocal<?>> {
            /** The value associated with this ThreadLocal. */
            Object value;

            Entry(ThreadLocal<?> k, Object v) {
                super(k);
                value = v;
            }
        }

        /**
         * The table, resized as necessary.
         * table.length MUST always be a power of two.
         */
        private Entry[] table;
    }
}
```

### threadLocals和inheritableThreadLocals

从Thread源码中可以看到ThreadLocal.ThreadLocalMa类型的成员变量有两个，有个是之前没有见过的inheritableThreadLocals，这个变量不是给ThreadLocal用的，而是给另一个类似的工具InheritableThreadLocal用的。

```java
public class InheritableThreadLocal<T> extends ThreadLocal<T> {

    protected T childValue(T parentValue) {
        return parentValue;
    }

    ThreadLocalMap getMap(Thread t) {
       return t.inheritableThreadLocals;
    }

    void createMap(Thread t, T firstValue) {
        t.inheritableThreadLocals = new ThreadLocalMap(this, firstValue);
    }
}
```

从源码上看，InheritableThreadLocal继承了ThreadLocal，然后使用的MAP换了，其他就没什么特别的。

但InheritableThreadLocal有着特殊的功能：它可以使用父线程的inheritableThreadLocals变量，实现父子线程共享变量。

InheritableThreadLocal为什么可以让子线程使用父线程的变量，关键的地方不在它，而在Thread类的初始化流程，Thread初始化时，

```java
public class Thread implements Runnable {

    private void init(ThreadGroup g, Runnable target, String name,
                      long stackSize, AccessControlContext acc,
                      boolean inheritThreadLocals) {
        // 略
        Thread parent = currentThread();
        // 略
        // inheritThreadLocals默认为true
        // 父线程inheritableThreadLocals不为空则复制一份
        // 值复制，非引用复制
        // 只是复制父线程当前拥有的对象
        if (inheritThreadLocals && parent.inheritableThreadLocals != null)
            this.inheritableThreadLocals =
                ThreadLocal.createInheritedMap(parent.inheritableThreadLocals);
        // 略
    }
}
```

### ThreadLocal中的弱引用(WeakReference)

从上面的源码中注意到: ThreadLocal.ThreadLocalMap.Entry extends WeakReference<ThreadLocal<?>>

Entry的key是ThreadLocal<?>，是个弱引用（被GC扫描到就回收）。如果不这样，当ThreadLocal<?>用完了，但线程还没结束，因此Thread里面还持有着ThreadLocal<?>的强引用，那么它永远不会被回收，可以认为内存泄漏了。

### ThreadLocal的内存泄漏

就算是使用了弱引用，依然存在内存泄漏的可能。因为弱引用仅仅是Entry的key(ThreadLocal)，value（泛型T）并不是弱引用。最终可能出现的结果就是，ThreadLocal被回收了，Thread里的MAP中KEY就没了，但value还在，这样一来这个value永远不会被get()方法返回，确又存在于内存不愿消散。

内部实现尽量避免内存泄漏：
> 在ThreadLocal的get()、set()、remove()方法调用的时候会清除掉线程ThreadLocalMap中所有Entry中Key为null的Value，并将整个Entry设置为null，利于下次内存回收。

如果没有调用这些方法去触发这个过程，依然会内存泄漏，所以在线程用完这个对象后，可以显示调用remove方法使其清除。