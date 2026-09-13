package butvan.agent.network.controller;

import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.dto.file.FileTreeNodeDto;
import butvan.agent.network.service.FileTreeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 项目文件树只读接口（供前端右侧面板的“文件”页签使用）。
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileTreeController {

    private final FileTreeService fileTreeService;

    /**
     * 查询项目根目录下的文件树。
     *
     * @param projectId 已登记项目 ID
     * @param depth 期望遍历深度（1-6，默认 3）
     * @return 排序后的顶层节点列表
     */
    @GetMapping("/tree")
    @ApiLog("查询项目文件树")
    public Result<List<FileTreeNodeDto>> tree(
            @RequestParam String projectId,
            @RequestParam(defaultValue = "3") int depth) {
        return Result.success(fileTreeService.list(projectId, depth));
    }
}
