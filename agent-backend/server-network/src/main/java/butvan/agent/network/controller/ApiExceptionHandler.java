package butvan.agent.network.controller;

import butvan.agent.network.common.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** 将可预期的参数与配置错误返回为统一的接口响应，并记录带上下文的日志。 */
@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {

    /** 参数或业务校验错误统一返回 400。 */
    @ExceptionHandler(IllegalArgumentException.class)
    public Result<Void> handleInvalidRequest(IllegalArgumentException exception) {
        log.warn("[API-LOG] 请求参数或业务校验失败: {}", exception.getMessage());
        return Result.error(400, exception.getMessage());
    }

    /** 服务暂不可用（如邮件服务未配置）统一返回 503。 */
    @ExceptionHandler(IllegalStateException.class)
    public Result<Void> handleUnavailableService(IllegalStateException exception) {
        log.error("[API-LOG] 服务暂不可用: {}", exception.getMessage(), exception);
        return Result.error(503, exception.getMessage());
    }

    /** SMTP 发送失败统一返回 503，不向客户端透出底层邮件异常细节。 */
    @ExceptionHandler(MailException.class)
    public Result<Void> handleMailFailure(MailException exception) {
        log.error("[API-LOG] 邮件发送失败，请检查 SMTP 配置: {}", exception.getMessage(), exception);
        return Result.error(503, "邮件服务暂不可用，请检查 SMTP 配置后重试");
    }
}
