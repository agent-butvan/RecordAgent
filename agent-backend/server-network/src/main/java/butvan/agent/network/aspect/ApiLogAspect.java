package butvan.agent.network.aspect;

import butvan.agent.agents.agent.AgentUserCall;
import butvan.agent.network.chat.dto.AgentChatRequest;
import butvan.agent.agents.config.LocalConfigService;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.dto.SetModel;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * 后端 REST API 规范化请求与响应日志打印切面
 * 基于 @ApiLog 自定义注解进行精准拦截并输出包含接口作用描述的规范日志
 */
@Slf4j
@Aspect
@Component
public class ApiLogAspect {

    /**
     * 切入点：拦截标注了 @ApiLog 注解的 Controller 接口方法
     */
    @Pointcut("@annotation(butvan.agent.network.annotation.ApiLog)")
    public void apiLogPointcut() {
    }

    /**
     * 环绕通知：拦截标注了 @ApiLog 的 API 请求，并规范化输出接口功能描述、请求参数、耗时及响应结果
     *
     * @param joinPoint 切入点对象
     * @return 接口响应结果
     * @throws Throwable 运行异常
     */
    @Around("apiLogPointcut()")
    public Object logAround(ProceedingJoinPoint joinPoint) throws Throwable {
        long startTime = System.currentTimeMillis();

        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        HttpServletRequest request = attributes != null ? attributes.getRequest() : null;

        // 提取 @ApiLog 注解中传入的接口描述属性
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        ApiLog apiLogAnnotation = method.getAnnotation(ApiLog.class);
        String description = apiLogAnnotation != null ? apiLogAnnotation.value() : "未命名接口";

        String httpMethod = request != null ? request.getMethod() : "UNKNOWN";
        String requestUri = request != null ? request.getRequestURI() : "UNKNOWN";
        String remoteAddr = request != null ? request.getRemoteAddr() : "UNKNOWN";
        String className = joinPoint.getTarget().getClass().getSimpleName();
        String methodName = method.getName();
        String argumentsSummary = Arrays.stream(joinPoint.getArgs())
                .map(this::summarizeValue)
                .collect(Collectors.joining(", ", "[", "]"));

        log.info("[API-LOG] >>> START | Description: [{}] | Method: [{} {}] | Client: [{}] | Handler: [{}.{}] | Args: {}",
                description, httpMethod, requestUri, remoteAddr, className, methodName, argumentsSummary);

        Object result;
        try {
            result = joinPoint.proceed();
            long timeTaken = System.currentTimeMillis() - startTime;
            log.info("[API-LOG] <<< END   | Description: [{}] | Method: [{} {}] | Status: [SUCCESS] | Cost: [{} ms] | Result: {}",
                    description, httpMethod, requestUri, timeTaken, summarizeValue(result));
            return result;
        } catch (Throwable e) {
            long timeTaken = System.currentTimeMillis() - startTime;
            log.error("[API-LOG] <<< ERROR | Description: [{}] | Method: [{} {}] | Status: [FAILED]  | Cost: [{} ms] | Exception: [{}]",
                    description, httpMethod, requestUri, timeTaken, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * 生成可用于接口日志的脱敏摘要，避免将用户输入、API Key 和完整配置写入日志。
     *
     * @param value 待记录对象
     * @return 安全摘要
     */
    private String summarizeValue(Object value) {
        if (value == null) {
            return "null";
        }
        if (value instanceof AgentUserCall agentUserCall) {
            int contextLength = agentUserCall.context() == null ? 0 : agentUserCall.context().length();
            return "AgentUserCall{sessionId='%s', contextLength=%d}"
                    .formatted(agentUserCall.sessionId(), contextLength);
        }
        if (value instanceof AgentChatRequest chatRequest) {
            int contentLength = chatRequest.content() == null ? 0 : chatRequest.content().length();
            int referenceCount = chatRequest.recordReferenceIds() == null ? 0 : chatRequest.recordReferenceIds().size();
            return "AgentChatRequest{sessionId='%s', contentLength=%d, referenceCount=%d}"
                    .formatted(chatRequest.sessionId(), contentLength, referenceCount);
        }
        if (value instanceof SetModel setModel) {
            return "SetModel{vendor='%s', modelName='%s', apiKey='***'}"
                    .formatted(setModel.vendor(), setModel.modelName());
        }
        if (value instanceof LocalConfigService.ModelConfigData modelConfigData) {
            int providerCount = modelConfigData.getProviders() == null ? 0 : modelConfigData.getProviders().size();
            return "ModelConfigData{activeVendor='%s', activeModel='%s', providerCount=%d, apiKey='***'}"
                    .formatted(modelConfigData.getActiveVendor(), modelConfigData.getActiveModel(), providerCount);
        }
        if (value instanceof Result<?> result) {
            String dataType = result.getData() == null ? "null" : result.getData().getClass().getSimpleName();
            return "Result{code=%s, message='%s', dataType='%s'}"
                    .formatted(result.getCode(), result.getMessage(), dataType);
        }
        return value.getClass().getSimpleName();
    }
}
