package butvan.agent.network.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一网络 API 响应结果包装类
 *
 * @param <T> 响应数据类型
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {

    /**
     * 响应状态码（200 为成功，非 200 为异常）
     */
    private Integer code;

    /**
     * 响应提示信息
     */
    private String message;

    /**
     * 响应数据体
     */
    private T data;

    /**
     * 构建成功响应结果（带数据体）
     *
     * @param data 响应数据
     * @param <T> 数据泛型
     * @return Result
     */
    public static <T> Result<T> success(T data) {
        return new Result<T>(200, "success", data);
    }

    /**
     * 构建成功响应结果（带自定义提示信息与数据体）
     *
     * @param message 自定义提示信息
     * @param data 响应数据
     * @param <T> 数据泛型
     * @return Result
     */
    public static <T> Result<T> success(String message, T data) {
        return new Result<T>(200, message, data);
    }

    /**
     * 构建失败响应结果（使用默认 500 状态码）
     *
     * @param message 错误信息
     * @param <T> 数据泛型
     * @return Result
     */
    public static <T> Result<T> error(String message) {
        return new Result<T>(500, message, null);
    }

    /**
     * 构建失败响应结果（指定错误状态码与信息）
     *
     * @param code 错误码
     * @param message 错误信息
     * @param <T> 数据泛型
     * @return Result
     */
    public static <T> Result<T> error(Integer code, String message) {
        return new Result<T>(code, message, null);
    }
}
