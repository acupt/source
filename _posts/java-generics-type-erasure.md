---
title: JAVA泛型与类型擦除
date: 2019-07-28 22:30:00
tags:
 - 泛型
 - 类型擦除
categories: JAVA
---

> 泛型的本质是参数化类型，这种参数类型可以用在类、接口和方法的创建中。泛型是在JAVA 1.5版本中才引入的，它能和以前的版本兼容的原因是泛型信息只存在于代码编译阶段，在进入 JVM 之前，与泛型相关的信息会被擦除掉，即类型擦除。

## 泛型的定义与使用

根据使用情况可以分为以下三种：

+ 泛型类
+ 泛型方法
+ 泛型接口

下面是一个常用的泛型类：

```java
// 一个泛型类，可以根据需要包装不同结果的返回值
public class Result<T> {

    private boolean success;

    private String message;

    private T data;

    // 一个泛型方法
    // 返回值类型定义前的<T>是必须的，用来声明一个类型持有者名称，然后就可以把T当作一个类型代表来声明成员、参数和返回值类型。
    public static <T> Result<T> success(T data) {
        Result<T> r = new Result<>();
        r.success = true;
        r.data = data;
        return r;
    }

    public static <T> Result<T> error(String message) {
        Result<T> r = new Result<>();
        r.message = message;
        return r;
    }

    // getter & setter
}
```

## 类型参数

上面尖括号中的T即类型参数，代指任何类，使用时可以替换成任意类，如：

```java
public class Main {

    public static void main(String[] args) {
        Result<Date> r1 = Result.success(new Date());
        Result<List<String>> r2 = Result.success(Arrays.asList("s1", "s2"));
    }

}
```

为什么要用T而不是其它字母？事实上是可以任意字符串（如Result< something >），但是为了显得专业，一般约定几个大写字母在不同场景使用。

+ T 最常用，一般代指任意类，不知道用啥就用它
+ E 代表Element，一般用在集合的泛型场景
+ K 代表Key，一般和Value一起出现在键值对场景（如Entry<K,V>）
+ V 代表Value，一般和Key一起出现在键值对场景（如Entry<K,V>）
+ 还有些不太常见的如S，U...

## 泛型通配符

如果在某些场景下我们不关注（或者不那么关注）泛型对象的类型参数，可以使用泛型通配符。

+ <?> 无限制的通配符，表示操作和类型无关
+ <? extends T> 类型参数必须是T或者T的子类
+ <? super T> 类型参数必须是T或者T的父类

```java
import java.util.Date;

public class Main {

    public static void main(String[] args) {
        // 由于这里只需要知道方法是否成功，不需要处理返回的对象，所以可以使用通配符，这样就算以后返回值改了这里也不用改
        Result<?> r1 = checkDate();
        System.out.println(r1.isSuccess() ? "成功" : "失败");
    }

    private static Result<Date> checkDate() {
        if (Math.random() > 0.5) {
            return Result.success(new Date());
        }
        return Result.error("system error");
    }

}
```
## 类型擦除

> 在Java SE 1.5之前，没有泛型的情况的下，通过对类型Object的引用来实现参数的“任意化”，“任意化”带来的缺点是要做显式的强制类型转换，而这种转换是要求开发者对实际参数类型可以预知的情况下进行的。对于强制类型转换错误的情况，编译器可能不提示错误，在运行的时候才出现异常，这是一个安全隐患。
泛型的好处是在编译的时候检查类型安全，并且所有的强制转换都是自动和隐式的，以提高代码的重用率。

```java
import java.lang.reflect.Field;
import java.util.Date;

public class Main {

    public static void main(String[] args) throws NoSuchFieldException {
        Result<Date> r1 = Result.success(new Date());
        Result<Number> r2 = Result.success(2.333);
        dataType(r1);
        dataType(r2);
    }

    private static void dataType(Result<?> result) throws NoSuchFieldException {
        Field field = result.getClass().getDeclaredField("data");
        System.out.println(field.getType().toString());
    }

}

/* 输出:

class java.lang.Object
class java.lang.Object

*/
```

通过反射我们在运行时得到了data的类型，发现都是Object，证明代码编译后所谓泛型都没了，这就是泛型擦除。

但并不是任何时候都是Obejct，如果用了带限制的泛型又将不一样，大概这么个意思：

```java
public class Result<T extends Number> {

    private boolean success;

    private String message;

    private T data;

    public static <T extends Number> Result<T> success(T data) {
        Result<T> r = new Result<>();
        r.success = true;
        r.data = data;
        return r;
    }

    public static <T extends Number> Result<T> error(String message) {
        Result<T> r = new Result<>();
        r.message = message;
        return r;
    }

    // getter & setter
}

public class Main {

    public static void main(String[] args) throws NoSuchFieldException {
        Result<Double> r1 = Result.success(2.333);
        Result<Long> r2 = Result.success(Long.MAX_VALUE);
        dataType(r1);
        dataType(r2);
    }

    private static void dataType(Result<?> result) throws NoSuchFieldException {
        Field field = result.getClass().getDeclaredField("data");
        System.out.println(field.getType().toString());
    }

}

/* 输出:

class java.lang.Number
class java.lang.Number

*/
```

## 通过反射绕过泛型限制

从上面例子可以感受到，所谓泛型，不过是编译过程及其之前才有的概念，主要还是为了方便开发。

最后搞个骚操作，通过反射绕过泛型限制。

```java

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Date;

public class Main {

    public static void main(String[] args) throws Exception {
        ArrayList<Integer> list = new ArrayList<Integer>();
        //正规途径
        list.add(1);
        //反射大法
        Method m = list.getClass().getMethod("add", Object.class);
        m.invoke(list, 2);
        m.invoke(list, 3.21);
        m.invoke(list, "对不起，我是字符串");
        m.invoke(list, new Date());
        for (Integer x : list) {
            System.out.println(x.getClass().getName() + ":\t" + x);
        }
    }
}

/* 输出:

java.lang.Integer:	1
java.lang.Integer:	2
Exception in thread "main" java.lang.ClassCastException: java.lang.Double cannot be cast to java.lang.Integer
	at Main.main(Main.java:20)

*/
```

竟然报错了（当然是故意的，真的），看看错误信息，因为要把Double转为Integer导致异常。但我们发现前面的两个输出是成功的，证明程序能编译成功并运行。

略作调整：

```java

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Date;

public class Main {

    public static void main(String[] args) throws Exception {
        ArrayList<Integer> list = new ArrayList<Integer>();
        //正规途径
        list.add(1);
        //反射大法
        Method m = list.getClass().getMethod("add", Object.class);
        m.invoke(list, 2);
        m.invoke(list, 3.21);
        m.invoke(list, "对不起，我是字符串");
        m.invoke(list, new Date());
        for (Object x : list) {
            System.out.println(x.getClass().getName() + ":\t" + x);
        }
    }
}

/* 输出:

java.lang.Integer:	1
java.lang.Integer:	2
java.lang.Double:	3.21
java.lang.String:	对不起，我是字符串
java.util.Date:	Sun Jul 28 23:49:34 CST 2019

*/
```

## 总结

![没写，懒得写](/img/没写懒得写.png)
