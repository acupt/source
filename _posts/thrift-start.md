---
title: thrift-Java 示例
date: 2018-11-20 20:00:00
tags:
 - rpc
 - thrift
categories: 微服务
thumbnail: /img/micro-service/thrift.jpg
---

### 安装thrift

mac

> brew install thrift

安装完成检查

> thrift --version

### 新建maven项目

pom.xml

```xml
    <dependencies>
        <dependency>
            <groupId>org.apache.thrift</groupId>
            <artifactId>libthrift</artifactId>
            <version>0.11.0</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.thrift</groupId>
                <artifactId>thrift-maven-plugin</artifactId>
                <version>0.10.0</version>
                <configuration>
                    <thriftExecutable>/usr/local/bin/thrift</thriftExecutable> <!--thrift安装路径-->
                    <thriftSourceRoot>src/main/resources</thriftSourceRoot> <!--thrift配置文件路径-->
                </configuration>
                <executions>
                    <execution>
                        <id>thrift-sources</id>
                        <phase>generate-sources</phase>
                        <goals>
                            <goal>compile</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
```

### 定义服务

新建文件 src/main/resources/service.thrift

```java
namespace java com.acupt.thritf.service
service HelloService{
    string hello(1:string name)
}
```

### 构建

使用maven插件根据.proto文件生成Java代码，插件已在pom.xml中配置，只需执行命令：

> mvn install

构建完成后可以在target中找到生成的Java代码，用这些代码可以实现thrift远程调用。

target/generated-sources/thrift/com/acupt/thritf/service/HelloService.java

如果在项目中无法直接引用上面的类，IDEA右键thrift文件夹 -> Mark Directory as -> Generated Sources Root

现在就可以在项目中引用了

### 代码

3个类

```java
package com.acupt.thrift;

import com.acupt.thritf.service.HelloService;
import org.apache.thrift.TException;

/**
 * 服务实现类
 */
public class HelloServiceImpl implements HelloService.Iface {

    @Override
    public String hello(String name) throws TException {
        return "hello," + name;
    }
}

```

```java
package com.acupt.thrift;

import com.acupt.thritf.service.HelloService;
import org.apache.thrift.TProcessor;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.server.TServer;
import org.apache.thrift.server.TSimpleServer;
import org.apache.thrift.transport.TServerSocket;

/**
 * 服务提供方
 */
public class MyServer {
    public static void main(String args[]) {
        try {
            TProcessor tprocessor = new HelloService.Processor<HelloService.Iface>(new HelloServiceImpl());
            TServerSocket serverTransport = new TServerSocket(50005);
            TServer.Args tArgs = new TServer.Args(serverTransport);
            tArgs.processor(tprocessor);
            tArgs.protocolFactory(new TBinaryProtocol.Factory());
            TServer server = new TSimpleServer(tArgs);
            System.out.println("server starting");
            //定时关闭
            new Thread(() -> {
                try {
                    System.out.println("server wait stop");
                    Thread.sleep(30000);
                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
                System.out.println("server stopping");
                server.stop();
                System.out.println("server stop");
            }).start();
            server.serve();//会阻塞
            System.out.println("server finish");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

}

```

```java
package com.acupt.thrift;

import com.acupt.thritf.service.HelloService;
import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.transport.TSocket;
import org.apache.thrift.transport.TTransport;

/**
 * 服务调用方
 */
public class MyClient {

    public static void main(String[] args) {
        TTransport transport = null;
        try {
            transport = new TSocket("localhost", 50005);
            TProtocol protocol = new TBinaryProtocol(transport);
            HelloService.Client client = new HelloService.Client(protocol);
            transport.open();
            String result = client.hello("tom");
            System.out.println(result);
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (null != transport) {
                transport.close();
            }
        }
    }

}

```

先启动MyServer，成功启动后再启动MyClient。

和grpc用法差不多，[gRPC-Java 示例](/2018/10/23/grpc-start)