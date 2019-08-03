---
title: 跨域Access-Control-Allow-Origin解决方案
date: 2019-07-31 19:00:00
tags:
 - 跨域
categories: 随笔
img: /img/acao/jsonp回调.png
---

> 前端访问其它域名的资源往往会失败，那是因为浏览器出于安全考虑禁止了不同源的资源。

## 同源策略

> 同源策略，它是由Netscape提出的一个著名的安全策略。现在所有支持JavaScript的浏览器都会使用这个策略。所谓同源是指，域名，协议，端口相同。同源策略是浏览器的行为，是为了保护本地数据不被JavaScript代码获取回来的数据污染，因此拦截的是客户端发出的请求回来的数据接收，即请求发送了，服务器响应了，但是无法被浏览器接收。

同源：协议 + 域名 + 端口

既然是浏览器的策略，则说明资源请求是可以正常返回的，只是浏览器不给用。

## 跨域报错

本地启动了一个web服务，地址为 127.0.0.1:8882 ，然后通过一个本地静态页面去请求这个接口。虽然在同一台电脑，但依然是跨域的。

![跨域报错](/img/acao/跨域报错.png)

上面也说了这个限制是浏览器做的，看看接口，其实已经请求成功了，后端是执行了相关代码的。

![跨域请求200](/img/acao/跨域请求200.png)

![跨域请求能到服务端](/img/acao/跨域请求能到服务端.png)

![跨域请求来源端口](/img/acao/跨域请求来源端口.png)

## 后端修改Response支持跨域

从上面控制台的输出可以看到，错误原因是请求的资源（接口）的header中没有”Access-Control-Allow-Origin“，那我们可以给它加上。在哪加？既然说是请求的资源没有，那当然是在请求的资源上加，也就是服务端。

```java
@SpringBootApplication
@Configuration
@RestController
public class ApplicationA {

    public static void main(String[] args) {
        SpringApplication.run(ApplicationA.class, args);
    }

    @RequestMapping("/test")
    public Object test(HttpServletRequest request, HttpServletResponse response) {
        // 跨域支持
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "POST,GET,PUT,DELETE");
        response.setHeader("Access-Control-Max-Age", "3600");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        Map<String, Object> map = new HashMap<>();
        map.put("success", true);
        map.put("msg", "我来自服务端");
        return map;
    }
}
```

再看看浏览器，已经可以正常访问接口了。

![跨域请求成功](/img/acao/跨域请求成功.png)

如果觉得每个接口里面都要配置一下response很麻烦，可以在一个拦截器里面做这个事情。

## springboot支持跨域

测试用例是一个springboot项目，可以用更简单的方式。通过一个继承了WebMvcConfigurerAdapter的bean，重写addCorsMappings方法，在方法里配置。

```java
@SpringBootApplication
@Configuration
@RestController
public class ApplicationA extends WebMvcConfigurerAdapter {

    public static void main(String[] args) {
        SpringApplication.run(ApplicationA.class, args);
    }

    @RequestMapping("/test")
    public Object test(HttpServletRequest request, HttpServletResponse response) {
        Map<String, Object> map = new HashMap<>();
        map.put("success", true);
        map.put("msg", "我来自服务端");
        return map;
    }

    // 跨域支持
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*")
                .allowCredentials(true)
                .allowedMethods("GET", "POST", "DELETE", "PUT")
                .maxAge(3600);
    }
```

## jsonp支持跨域

有前端经验的童鞋知道，有时我们会在自己的代码里直接引入其它域名的js、css等静态文件。为啥这些静态文件没被浏览器限制呢？通常为了减轻web服务器的压力，我们会把js、css，img等静态资源分离到另一台独立域名的服务器上，使其和前端分离开。基于这个原因，浏览器并没有限制这类静态资源的跨域访问。

我们可以动态地创建一个script，让浏览器以为我们要获取静态资源，从而网开一面。而服务器端也需要做一点改变，不能直接返回json，而是返回一个立即执行的函数，而前端请求的结果就作为函数的参数。

### 后端接口返回

```java
@SpringBootApplication
@Configuration
@RestController
public class ApplicationA {

    public static void main(String[] args) {
        SpringApplication.run(ApplicationA.class, args);
    }

    @RequestMapping("/test")
    public String test(HttpServletRequest request, HttpServletResponse response, String callback)
            throws IOException {
        Map<String, Object> map = new HashMap<>();
        map.put("success", true);
        map.put("msg", "我来自服务端");
        // 返回值如下：
        // callback({"msg":"我来自服务端","success":true});
        return String.format("%s(%s);", callback, JsonUtil.toJson(map));
    }
```

### js原生实现jsonp

```js

function test() {
    // 外部域名，参数是和后端接口约定的callback指定接口返回后的回调函数
    url = "http://localhost:8882/test?callback=_ajax_callback";
    // 创建一个script元素
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    document.head.appendChild(script);
}

// 接口回调
function _ajax_callback(res) {
    console.log("被回调了");
    console.log(res);
}
```

接口返回：

![jsonp返回](/img/acao/jsonp返回.png)

回调函数执行：

![jsonp回调](/img/acao/jsonp回调.png)

### jQuery实现jsonp

一般我们会使用jQuery来做ajax请求，这样需要增加一个jQuery的引用。

```js
// 没测，懒得测
$.ajax({
    url: 'http://localhost:8882/test',
    type: 'get',
    dataType: 'jsonp',  // 请求方式
    jsonpCallback: "_ajax_callback",    // 回调函数名
    data: {}
});
```

### vue.js实现jsonp

现在前端vue.js用的也很多，再记录一个vue.js的用法。

```js
// 没测，懒得测
this.$http.jsonp('http://localhost:8882/test', {
    params: {},
    jsonp: '_ajax_callback'
}).then((res) => {
    console.log(res); 
})
```

### jsonp缺点

只能实现get请求。

## 其它方式支持跨域

+ nginx反向代理：前端访问相同域名，nginx再根据需要把请求转发到外部域名；
+ 后端代理：在后端接口里先请求外部资源（比如用HttpClient），然后把结果返回给前端，这样就不是跨域了；
+ 其它：借助iframe、postMessage等也可实现跨域。
