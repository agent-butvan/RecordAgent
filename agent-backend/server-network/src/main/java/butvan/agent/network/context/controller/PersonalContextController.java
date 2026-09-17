package butvan.agent.network.context.controller;

import butvan.agent.agents.context.PersonalContextService;
import butvan.agent.agents.context.ProfileMaintenanceService;
import butvan.agent.agents.identity.CurrentUserProvider;
import butvan.agent.network.annotation.ApiLog;
import butvan.agent.network.common.Result;
import butvan.agent.network.context.dto.PersonalContextDtos;
import butvan.agent.network.context.dto.PersonalContextDtos.Response;
import butvan.agent.network.context.dto.PersonalContextDtos.MaintenanceResponse;
import butvan.agent.network.context.dto.PersonalContextDtos.AcceptProposalRequest;
import butvan.agent.network.context.dto.PersonalContextDtos.UpdateEnabledRequest;
import butvan.agent.network.context.dto.PersonalContextDtos.UpdateMaintenanceRequest;
import butvan.agent.network.context.dto.PersonalContextDtos.UpdateProfileRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 个人上下文设置的 HTTP 协议适配层。 */
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/agent/personal-context")
@RequiredArgsConstructor
public class PersonalContextController {

    private final PersonalContextService personalContextService;
    private final ProfileMaintenanceService profileMaintenanceService;
    private final CurrentUserProvider currentUserProvider;

    /** 查询当前画像、来源、开关与预算。 */
    @ApiLog("查询个人上下文设置")
    @GetMapping
    public Result<Response> get() {
        return Result.success(PersonalContextDtos.from(
                personalContextService.get(currentUserProvider.currentUserId())));
    }

    /** 保存当前用户显式维护的画像。 */
    @ApiLog("保存个人上下文画像")
    @PutMapping("/profile")
    public Result<Response> updateProfile(@RequestBody UpdateProfileRequest request) {
        return Result.success(PersonalContextDtos.from(personalContextService.save(
                currentUserProvider.currentUserId(), request == null ? null : request.profile())));
    }

    /** 开启或暂停画像与相关记忆自动注入。 */
    @ApiLog("更新个人上下文开关")
    @PutMapping("/enabled")
    public Result<Response> updateEnabled(@RequestBody UpdateEnabledRequest request) {
        if (request == null) throw new IllegalArgumentException("缺少个人上下文开关");
        return Result.success(PersonalContextDtos.from(personalContextService.setEnabled(
                currentUserProvider.currentUserId(), request.enabled())));
    }

    /** 清空显式画像，同时阻止旧画像回退。 */
    @ApiLog("清空个人上下文画像")
    @DeleteMapping("/profile")
    public Result<Response> clearProfile() {
        return Result.success(PersonalContextDtos.from(
                personalContextService.clear(currentUserProvider.currentUserId())));
    }

    /** 查询辅助维护状态与待审核提案。 */
    @ApiLog("查询画像辅助维护状态")
    @GetMapping("/maintenance")
    public Result<MaintenanceResponse> getMaintenance() {
        return Result.success(PersonalContextDtos.from(
                profileMaintenanceService.status(currentUserProvider.currentUserId())));
    }

    /** 开启或暂停低频画像提案生成。 */
    @ApiLog("更新画像辅助维护开关")
    @PutMapping("/maintenance/enabled")
    public Result<MaintenanceResponse> updateMaintenance(@RequestBody UpdateMaintenanceRequest request) {
        if (request == null) throw new IllegalArgumentException("缺少画像辅助维护开关");
        return Result.success(PersonalContextDtos.from(profileMaintenanceService.setEnabled(
                currentUserProvider.currentUserId(), request.enabled())));
    }

    /** 立即使用现有记忆检查一次画像变化。 */
    @ApiLog("立即检查画像变化")
    @PostMapping("/maintenance/check")
    public Result<MaintenanceResponse> checkMaintenance() {
        return Result.success(PersonalContextDtos.from(
                profileMaintenanceService.checkNow(currentUserProvider.currentUserId())));
    }

    /** 确认并应用指定画像提案。 */
    @ApiLog("确认画像维护提案")
    @PutMapping("/proposals/{proposalId}/accept")
    public Result<Response> acceptProposal(
            @PathVariable String proposalId,
            @RequestBody AcceptProposalRequest request
    ) {
        if (request == null || request.expectedRevision() == null) {
            throw new IllegalArgumentException("缺少画像 revision");
        }
        return Result.success(PersonalContextDtos.from(profileMaintenanceService.accept(
                currentUserProvider.currentUserId(), proposalId,
                request.expectedRevision(), request.profile())));
    }

    /** 拒绝指定画像提案，不修改当前画像。 */
    @ApiLog("拒绝画像维护提案")
    @DeleteMapping("/proposals/{proposalId}")
    public Result<MaintenanceResponse> rejectProposal(@PathVariable String proposalId) {
        return Result.success(PersonalContextDtos.from(profileMaintenanceService.reject(
                currentUserProvider.currentUserId(), proposalId)));
    }
}
