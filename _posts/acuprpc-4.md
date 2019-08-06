---
title: 从0.5到1写个rpc框架 - 4:request filter
date: 2018-11-29 13:00:00
tags:
 - 微服务
 - filter
 - 责任链
 - spring
categories: 微服务
# thumbnail: /img/micro-service/acuprpc.png
---

> 这不是教程，只是个人总结，有兴趣的童鞋可以搭配源码看看：[acuprpc](https://github.com/acupt/acuprpc)

为了后续扩展方便，搞个filter支持，就抄一个servlet的filter吧。

## servlet filter 分析

在写mvc项目时，经常会用到filter，可以给一个请求做前置或者后置处理。如下：

```java
@WebFilter(filterName = "requestFilter", urlPatterns = "/*")
public class MyFilter implements Filter {
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        System.out.println("filter init");
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
    throws IOException, ServletException {
        System.out.println("我进来了");
        chain.doFilter(request, response);
        System.out.println("我要走了");
    }

    @Override
    public void destroy() {
        System.out.println("filter destroy");
    }
}
```

这是一种责任链模式的实现，debug看下调用栈可以了解框架是怎么实现的。

+ 每次请求生成一个FilterChain对象，并使其持有所有filter的数组，初始化成员变量pos=0（表示应该执行第几个filter）
+ 从FilterChain.doFilter开始调用整个链路，从第一个filter开始，调用时会把chain本身传给filter，pos自增
+ 某个filter如果不拦截这个请求，则调用FilterChain.doFilter，由于pos已经自增，则会调用下一个filter
+ filter全部调用后（pos=filters.length）,开始真正执行请求
+ 请求返回后会依次再经过之前经过的所有filter（倒序）

<!-- ![filter](/img/spring/filter.png) -->

![filter](https://oscimg.oschina.net/oscnet/1b3313c4302569b512448430ba93ee50ee2.jpg)

## rpc filter 实现

定义filter接口，使用者如果要添加过滤逻辑需要集成这个接口。

```java
public interface RpcFilter {
    void doFilter(RpcRequest request, RpcResponse response, RpcFilterChain filterChain);
}
```

filter持有者

```java
public class RpcFilterChain implements RpcCode {
    private RpcFilter[] filters = new RpcFilter[0];
    private int pos;
    private RpcServiceInfo serviceInfo;
    private RpcServiceExecutor serviceExecutor;//最终要执行请求的处理器

    public RpcFilterChain(List<RpcFilter> filterList, RpcServiceInfo serviceInfo, RpcServiceExecutor serviceExecutor) {
        if (filterList != null && !filterList.isEmpty()) {
            this.filters = new RpcFilter[filterList.size()];
            this.filters = filterList.toArray(this.filters);
        }
        this.serviceInfo = serviceInfo;
        this.serviceExecutor = serviceExecutor;
    }

    public void doFilter(RpcRequest request, RpcResponse response) {
        if (pos < filters.length) {
            RpcFilter filter = filters[pos++];
            filter.doFilter(request, response, this);
            return;
        }
        if (serviceExecutor == null) {
            response.error(SERVICE_NOT_FOUND, "service not exist: " + serviceInfo);
            return;
        }
        serviceExecutor.execute(request, response);
    }

}
```

rpc server 接收到请求后先初始化一个责任链，然后触发。

```java
    public RpcResponse execute(RpcRequest rpcRequest) {
        RpcServiceInfo rpcServiceInfo = new RpcServiceInfo(rpcRequest.getAppName(), rpcRequest.getServiceName());
        RpcFilterChain chain = new RpcFilterChain(filters, rpcServiceInfo, serviceExecutorMap.get(rpcServiceInfo));
        RpcResponse rpcResponse = new RpcResponse();
        try {
            chain.doFilter(rpcRequest, rpcResponse);
        } catch (Exception e) {
            rpcResponse.error(e);
        }
        return rpcResponse;
    }
```

