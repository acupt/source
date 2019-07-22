---
title: JAVA中的String真的不可变吗
date: 2019-07-17 23:00:00
tags:
 - java
categories: JAVA
---

> String是不可变的吗？是的！真想变？也行~

我们都知道，String是不可变对象，即一旦创建，那么就不能改变它的状态。对此，我们来分析一波。

## String的内部构造

小心翼翼进入String的内部，我们可以看到它是一个final类，那么没人能继承它，很好，很丁克。

然后直接看向它的灵魂，一个char数组，也是final，于是我们知道它怎么不可变了。

```java

public final class String
    implements java.io.Serializable, Comparable<String>, CharSequence {
    /** The value is used for character storage. */
    private final char value[];

    /** Cache the hash code for the string */
    private int hash; // Default to 0

    /** use serialVersionUID from JDK 1.0.2 for interoperability */
    private static final long serialVersionUID = -6849794470754667710L;

	// 略...
}
```

## 创建对象

直接用常量给String变量赋值，不管在几个地方，几次，它们都是用的同一个数据。

除非new一个新的String。

```java
public class StringTest {

    public static void main(String[] args) {
        String s1 = "abcd";
        String s2 = "abcd";
        String s3 = new String("abcd");
        String s4 = new String("abcd");
        System.out.println("两个常量赋值\t s1==s2:" + (s1 == s2));
        System.out.println("常量与新对象\t s1==s3:" + (s1 == s3));
        System.out.println("两个新对象\t s3==s4:" + (s3 == s4));
	}
}
```

输出

```
两个常量赋值	s1==s2:true
常量与新对象	s1==s3:false
两个新对象	s3==s4:false
```

## 利用反射修改值

上面的代码后面再加点东西，尝试修改s1的值。

```java
public class StringTest {

    public static void main(String[] args) throws NoSuchFieldException, IllegalAccessException {
        String s1 = "abcd";
        String s2 = "abcd";
        String s3 = new String("abcd");
        String s4 = new String("abcd");
        System.out.println("两个常量赋值\t s1==s2:" + (s1 == s2));
        System.out.println("常量与新对象\t s1==s3:" + (s1 == s3));
        System.out.println("两个新对象\t s3==s4:" + (s3 == s4));

        // 通过反射得到被String藏起来的value字段
        Field f = String.class.getDeclaredField("value");

        // 让它敞开心扉
        f.setAccessible(true);

        // 获取s1的内部value数组
        char[] v = (char[]) f.get(s1);

        // 改掉它第一个字母
        v[0] = 'x';

        System.out.println("改变过后...");
        System.out.println("s1 = " + s1);
        System.out.println("s2 = " + s2);
        System.out.println("s3 = " + s3);
        System.out.println("s4 = " + s4);
        System.out.println("两个常量赋值\t s1==s2:" + (s1 == s2));
        System.out.println("常量与新对象\t s1==s3:" + (s1 == s3));
        System.out.println("两个新对象\t s3==s4:" + (s3 == s4));
    }
}
```

输出

```
两个常量赋值	s1==s2:true
常量与新对象	s1==s3:false
两个新对象	s3==s4:false
改变过后...
s1 = xbcd
s2 = xbcd
s3 = xbcd
s4 = xbcd
两个常量赋值	s1==s2:true
常量与新对象	s1==s3:false
两个新对象	s3==s4:false
```

## 总结

1、String内部的value通过反射真的可以改变
2、直接改动value会导致其它相同值的String对象也被改变（所以可以猜测底层实际上用的同一份数据？）
3、虽然值都改变了，但作为对象，4个变量的关系依然没有改变（new的两个String和其他两个依然不等）
4、这样做很危险
5、这样做很无聊