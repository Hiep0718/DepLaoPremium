package com.zaloclone.core.controllers;

import com.zaloclone.core.dtos.ApiResponse;
import com.zaloclone.core.services.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
public class FileUploadController {

    private final S3Service s3Service;

    /**
     * Upload avatar image
     * POST /api/upload/avatar
     * Content-Type: multipart/form-data
     */
    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<?>> uploadAvatar(@RequestParam("file") MultipartFile file) {
        try {
            String url = s3Service.uploadFile(file, "avatars");
            return ResponseEntity.ok(ApiResponse.success("Upload avatar thành công", Map.of("url", url)));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Upload avatar thất bại: " + e.getMessage()));
        }
    }

    /**
     * Upload cover image
     * POST /api/upload/cover
     * Content-Type: multipart/form-data
     */
    @PostMapping(value = "/cover", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<?>> uploadCover(@RequestParam("file") MultipartFile file) {
        try {
            String url = s3Service.uploadFile(file, "covers");
            return ResponseEntity.ok(ApiResponse.success("Upload ảnh bìa thành công", Map.of("url", url)));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Upload ảnh bìa thất bại: " + e.getMessage()));
        }
    }

    /**
     * Upload chat file (image, video, document)
     * POST /api/upload/chat
     * Content-Type: multipart/form-data
     * Auto-detects file type and routes to correct S3 folder
     */
    @PostMapping(value = "/chat", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<?>> uploadChatFile(@RequestParam("file") MultipartFile file) {
        try {
            String contentType = file.getContentType();
            String folder;
            String messageType;

            if (contentType != null && contentType.startsWith("image/")) {
                folder = "chat-images";
                messageType = "image";
            } else if (contentType != null && contentType.startsWith("video/")) {
                folder = "chat-videos";
                messageType = "video";
            } else if (contentType != null && contentType.startsWith("audio/")) {
                folder = "chat-audio";
                messageType = "audio";
            } else {
                folder = "chat-files";
                messageType = "file";
            }

            String url = s3Service.uploadChatFile(file, folder);
            String originalName = file.getOriginalFilename();
            long fileSize = file.getSize();

            return ResponseEntity.ok(ApiResponse.success("Upload thành công", Map.of(
                "url", url,
                "messageType", messageType,
                "fileName", originalName != null ? originalName : "file",
                "fileSize", fileSize
            )));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Upload thất bại: " + e.getMessage()));
        }
    }
}
