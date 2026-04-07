package com.zaloclone.core.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.UUID;

@Service
public class S3Service {

    @Value("${aws.access-key:}")
    private String accessKey;

    @Value("${aws.secret-key:}")
    private String secretKey;

    @Value("${aws.s3.region:ap-southeast-1}")
    private String region;

    @Value("${aws.s3.bucket:}")
    private String bucketName;

    private S3Client s3Client;

    @PostConstruct
    public void init() {
        if (!accessKey.isEmpty() && !secretKey.isEmpty()) {
            this.s3Client = S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(
                            StaticCredentialsProvider.create(
                                    AwsBasicCredentials.create(accessKey, secretKey)
                            )
                    )
                    .build();
        }
    }

    /**
     * Upload file lên S3 và trả về public URL
     * @param file MultipartFile từ request
     * @param folder "avatars" hoặc "covers"
     * @return URL public của file đã upload
     */
    public String uploadFile(MultipartFile file, String folder) throws IOException {
        if (s3Client == null) {
            throw new RuntimeException("AWS S3 chưa được cấu hình. Vui lòng thêm AWS credentials vào application.properties");
        }

        if (file.isEmpty()) {
            throw new RuntimeException("File rỗng");
        }

        // Validate file type
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new RuntimeException("Chỉ chấp nhận file ảnh (image/*)");
        }

        // Generate unique file name
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String key = folder + "/" + UUID.randomUUID() + extension;

        // Upload to S3
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType)
                .build();

        s3Client.putObject(putObjectRequest, RequestBody.fromBytes(file.getBytes()));

        // Return public URL
        return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, key);
    }

    /**
     * Upload chat file (image, video, document) lên S3
     * @param file MultipartFile từ request
     * @param folder "chat-images", "chat-videos", "chat-files"
     * @return URL public của file đã upload
     */
    public String uploadChatFile(MultipartFile file, String folder) throws IOException {
        if (s3Client == null) {
            throw new RuntimeException("AWS S3 chưa được cấu hình. Vui lòng thêm AWS credentials vào application.properties");
        }

        if (file.isEmpty()) {
            throw new RuntimeException("File rỗng");
        }

        String contentType = file.getContentType();
        if (contentType == null) {
            contentType = "application/octet-stream";
        }

        // Generate unique file name
        String originalFilename = file.getOriginalFilename();
        String extension = "";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        String key = folder + "/" + UUID.randomUUID() + extension;

        // Upload to S3
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .contentType(contentType)
                .build();

        s3Client.putObject(putObjectRequest, RequestBody.fromBytes(file.getBytes()));

        // Return public URL
        return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, key);
    }
}
