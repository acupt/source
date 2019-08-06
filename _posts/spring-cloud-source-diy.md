---
title: spring cloud 自定义配置源及配置刷新
date: 2018-10-29 15:19:56
tags:
 - config
 - spring
categories: 微服务
thumbnail: /img/micro-service/sc.jpg
---

通过自定义配置源可以接入自己的配置服务，配合ContextRefresher可以让应用运行中自动更新配置。

### 实现PropertySourceLocator

```java
/**
 * 自定义配置源
 */
public class MyPropertySourceLocator implements PropertySourceLocator {

    @Override
    public PropertySource<?> locate(Environment environment) {
        String msg = new SimpleDateFormat("HH:mm:ss").format(new Date());

        Map<String, Object> map = new HashMap<>();
        map.put("demo.diy.msg", msg);
        System.err.println("MyPropertySourceLocator, demo.diy.msg = " + msg);

        //spring自带的一个简单的map结构配置集合，也可以继承PropertySource自定义
        MapPropertySource source = new MapPropertySource("my-source", map);
        return source;
    }
}
```

### 配置类

```java
@Configuration
public class MyConfigBootstrapConfiguration {

    @Bean
    public MyPropertySourceLocator myPropertySourceLocator() {
        return new MyPropertySourceLocator();
    }

}
```

用Java代码声明bean，还需要在resources/META-INF/spring.factories中声明

```java
org.springframework.cloud.bootstrap.BootstrapConfiguration=\
com.netease.ag.demoweb.MyConfigBootstrapConfiguration
```

> Spring中类似与Java SPI的加载机制。它在META-INF/spring.factories文件中配置接口的实现类名称，然后在程序中读取这些配置文件并实例化。这种自定义的SPI机制是Spring Boot Starter实现的基础。

### 使用自定义配置

```java
@RefreshScope //可更新
@Component
@Data
public class ValueConfig {

    @Value("${demo.copy.msg}")
    private String copyMsg;

    @Value("${demo.diy.msg}")
    private String diyMsg;

    public ValueConfig() {
        System.err.println("ValueConfig init");
    }
}
```

application.properties中可以引用自定义配置

```java
demo.copy.msg=${demo.diy.msg}
```

### springboot应用启动

```java
@SpringBootApplication
@RestController
public class DemowebApplication {

    @Resource
    private ValueConfig valueConfig;

    @Resource
    private ContextRefresher contextRefresher;

    public DemowebApplication() {
        System.err.println("DemowebApplication init");
    }

    public static void main(String[] args) {
        SpringApplication.run(DemowebApplication.class, args);
    }

    @RequestMapping("/t")
    public String t() {
        return valueConfig.toString();
    }

    //更新bean属性
    @RequestMapping("/r")
    public Object r() {
        return contextRefresher.refresh();
    }
```

启动日志
```java
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::        (v1.5.2.RELEASE)

MyPropertySourceLocator, demo.diy.msg = 17:18:22
...
DemowebApplication init
...
ValueConfig init
...Tomcat started on port(s): 8080 (http)
```

查询，多次请求返回一致
> 请求：http://localhost:8080/t
> 响应：ValueConfig(copyMsg=17:18:22, diyMsg=17:18:22)

更新
> 请求：http://localhost:8080/r
> 响应：["demo.diy.msg"]

日志输出：
```
MyPropertySourceLocator, demo.diy.msg = 17:27:44
```

再次调用查询接口，发现值改变，并且输出日志

```
ValueConfig init
```
证明更新字段实际是重新生成了一个bean

