---
title: spring rabbitmq 异常重试源码分析
date: 2018-11-15 11:00:00
tags:
 - spring
 - rabbitmq
categories: 随笔
thumbnail: /img/code.jpg
---

## springboot集成rabbitMQ

### 发消息

```java
    @Resource
    private RabbitTemplate rabbitTemplate;

    @Value("${my.exchange}")
    private String exchange;

    public void send(Object obj) {
        rabbitTemplate.convertAndSend(exchange, "", JsonUtils.toJson(obj));
    }
```

### 处理消息

```java
    @RabbitListener(queues = "${msg.queue.my.exchange}")
    public void receive(String msg) {
        //...
    }
```

默认情况下，如果处理消息时抛出了异常，这个消息会一直重复消费（重复调用receive方法），直到没有抛异常。

## 消息接收/处理流程分析

在@RabbitListener注解的方法里打个断点，观察下调用栈。

![](/img/spring/rabbitmq-listener-debug.jpg)

末端是个实现了Runnable的内部类SimpleMessageListenerContainer$AsyncMessageProcessingConsumer

```java
    @Override
    public void run() {
        //……
        //从这里可以看出只要这个消费者（consumer）状态满足会一直轮询去接收消息和消费消息
        while (isActive(this.consumer) || this.consumer.hasDelivery() || !this.consumer.cancelled()) {
		    try {
		    	boolean receivedOk = receiveAndExecute(this.consumer); // At least one message received
			    //……
            }
            //……
        }
    }
```

```java
	private boolean doReceiveAndExecute(BlockingQueueConsumer consumer) throws Throwable { //NOSONAR
		Channel channel = consumer.getChannel();
		for (int i = 0; i < this.txSize; i++) {
			logger.trace("Waiting for message from consumer.");
			Message message = consumer.nextMessage(this.receiveTimeout);
			if (message == null) {break;}
			try {
				//如果获取到了消息就会去消费，这里最终会执行到我们写的listener方法
				executeListener(channel, message);
			}
			//当我们写的方法抛异常的时候就会来到这里
			//发现嫌疑代码：consumer.rollbackOnExceptionIfNecessary(ex)
			catch (ImmediateAcknowledgeAmqpException e) {/*……*/}
			catch (Throwable ex) { //NOSONAR
				if (causeChainHasImmediateAcknowledgeAmqpException(ex)) {/*……*/}
				if (this.transactionManager != null) {/*没开事务，忽略*/}
				else {
					consumer.rollbackOnExceptionIfNecessary(ex);
					throw ex;
				}
			}
		}
		return consumer.commitIfNecessary(isChannelLocallyTransacted(channel));

	}
```

```java
	public void rollbackOnExceptionIfNecessary(Throwable ex) throws Exception {
		boolean ackRequired = !this.acknowledgeMode.isAutoAck() && !this.acknowledgeMode.isManual();
		try {
			if (this.transactional) {/*……*/}
			if (ackRequired) {
				boolean shouldRequeue = RabbitUtils.shouldRequeue(this.defaultRequeuRejected, ex, logger);
				for (Long deliveryTag : this.deliveryTags) {
					// 最终会执行到这里
					// With newer RabbitMQ brokers could use basicNack here...
					this.channel.basicReject(deliveryTag, shouldRequeue);
				}
				if (this.transactional) {/*……*/}
			}
		}
		catch (Exception e) {
			logger.error("Application exception overridden by rollback exception", ex);
			throw e;
		}
		finally {
			this.deliveryTags.clear();
		}
	}
```

由上可看出，导致无限重试的两个值：
+ ackRequired: 和ack模式相关
+ shouldRequeue: 和defaultRequeuRejected以及抛出的异常类型有关

根据需要修改acknowledgeMode或者defaultRequeuRejected即可，在配置文件中根据IDE补全提示可以找到这两个属性。

```
spring.rabbitmq.listener.acknowledge-mode=none
spring.rabbitmq.listener.default-requeue-rejected=false
```

如果只是不想异常时重试，直接在业务代码中try...catch全部代码不让抛异常也行。

PS：验证这两个配置的时候发现不生效，一番debug发现项目里面自定义了一个工厂bean，创建消费者相关对象时用的那个工厂bean，而不是根据配置属性生成。

```java
    @Bean
    public SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(new Jackson2JsonMessageConverter());
        return factory;
    }
```

注释掉这个bean那两个配置才生效，当然也可以在这个bean里设置那两个属性。