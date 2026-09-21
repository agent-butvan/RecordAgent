package butvan.agent.network.controller;

import butvan.agent.network.common.Result;
import org.junit.jupiter.api.Test;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ApiExceptionHandlerTest {

    @Test
    void shouldHideMultipartImplementationDetailsWhenUploadIsTooLarge() {
        ApiExceptionHandler handler = new ApiExceptionHandler();

        Result<Void> result = handler.handleUploadTooLarge(new MaxUploadSizeExceededException(512L * 1024 * 1024));

        assertEquals(400, result.getCode());
        assertEquals("上传文件过大，请选择符合页面大小要求的文件", result.getMessage());
        assertNull(result.getData());
    }
}
