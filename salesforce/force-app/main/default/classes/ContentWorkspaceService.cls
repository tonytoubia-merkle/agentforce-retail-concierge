/**
 * ContentWorkspaceService
 *
 * Service class for managing content in the Marketing Cloud Content Workspace.
 * Handles saving email content, images, and other assets to the MC-synced workspace.
 */
public with sharing class ContentWorkspaceService {

    // Content Workspace name for Marketing Cloud
    private static final String MC_WORKSPACE_NAME = 'Content Workspace for Marketing Cloud';

    // Cache the workspace ID
    private static Id mcWorkspaceId;

    /**
     * Get the Marketing Cloud Content Workspace ID.
     * Creates the workspace if it doesn't exist.
     *
     * @return ContentWorkspace ID
     */
    public static Id getMCWorkspaceId() {
        if (mcWorkspaceId != null) {
            return mcWorkspaceId;
        }

        List<ContentWorkspace> workspaces = [
            SELECT Id, Name
            FROM ContentWorkspace
            WHERE Name = :MC_WORKSPACE_NAME
            LIMIT 1
        ];

        if (!workspaces.isEmpty()) {
            mcWorkspaceId = workspaces[0].Id;
            return mcWorkspaceId;
        }

        // Workspace doesn't exist - try to create it
        // Note: Creating workspaces requires specific permissions
        try {
            ContentWorkspace newWorkspace = new ContentWorkspace(
                Name = MC_WORKSPACE_NAME,
                Description = 'Content synced with Marketing Cloud Advanced'
            );
            insert newWorkspace;
            mcWorkspaceId = newWorkspace.Id;
            return mcWorkspaceId;
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, 'Could not create MC Content Workspace: ' + e.getMessage());
            // Fall back to default workspace (user's personal library)
            return null;
        }
    }

    /**
     * Save email content as a ContentVersion in the MC Content Workspace.
     *
     * @param title Title for the content (e.g., "Birthday Email - John Smith")
     * @param htmlContent The HTML email body
     * @param contactId Related Contact ID (for linking)
     * @param eventType Event type (Birthday, Wedding, etc.)
     * @return SaveContentResult with ContentVersion ID and URL
     */
    public static SaveContentResult saveEmailContent(
        String title,
        String htmlContent,
        Id contactId,
        String eventType
    ) {
        SaveContentResult result = new SaveContentResult();

        try {
            // Create filename
            String timestamp = String.valueOf(DateTime.now().getTime());
            String filename = title.replaceAll('[^a-zA-Z0-9]', '_') + '_' + timestamp + '.html';

            // Create ContentVersion
            ContentVersion cv = new ContentVersion();
            cv.Title = title;
            cv.PathOnClient = filename;
            cv.VersionData = Blob.valueOf(htmlContent);
            cv.Description = 'Email content for ' + eventType + ' journey';
            cv.FirstPublishLocationId = getMCWorkspaceId(); // Place in MC workspace

            insert cv;

            // Query back to get ContentDocumentId
            cv = [
                SELECT Id, ContentDocumentId, Title
                FROM ContentVersion
                WHERE Id = :cv.Id
                LIMIT 1
            ];

            result.success = true;
            result.contentVersionId = cv.Id;
            result.contentDocumentId = cv.ContentDocumentId;
            result.contentUrl = '/sfc/servlet.shepherd/version/renditionDownload?rendition=ORIGINAL_Html&versionId=' + cv.Id;

            // Link content to Contact record
            if (contactId != null) {
                linkContentToRecord(cv.ContentDocumentId, contactId);
            }

            System.debug(LoggingLevel.INFO, '[saveEmailContent] Created ContentVersion: ' + cv.Id);

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
            System.debug(LoggingLevel.ERROR, '[saveEmailContent] Error: ' + e.getMessage());
        }

        return result;
    }

    /**
     * Save image content (from Firefly) to the MC Content Workspace.
     *
     * @param title Title for the image
     * @param imageBlob The image data
     * @param fileExtension File extension (png, jpg, etc.)
     * @param contactId Related Contact ID
     * @return SaveContentResult with ContentVersion ID and public URL
     */
    public static SaveContentResult saveImageContent(
        String title,
        Blob imageBlob,
        String fileExtension,
        Id contactId
    ) {
        SaveContentResult result = new SaveContentResult();

        try {
            String timestamp = String.valueOf(DateTime.now().getTime());
            String filename = title.replaceAll('[^a-zA-Z0-9]', '_') + '_' + timestamp + '.' + fileExtension;

            ContentVersion cv = new ContentVersion();
            cv.Title = title;
            cv.PathOnClient = filename;
            cv.VersionData = imageBlob;
            cv.Description = 'Generated image for marketing journey';
            cv.FirstPublishLocationId = getMCWorkspaceId();

            insert cv;

            cv = [
                SELECT Id, ContentDocumentId
                FROM ContentVersion
                WHERE Id = :cv.Id
                LIMIT 1
            ];

            // Create public URL for the image
            String publicUrl = createPublicUrl(cv.Id);

            result.success = true;
            result.contentVersionId = cv.Id;
            result.contentDocumentId = cv.ContentDocumentId;
            result.contentUrl = publicUrl;

            if (contactId != null) {
                linkContentToRecord(cv.ContentDocumentId, contactId);
            }

        } catch (Exception e) {
            result.success = false;
            result.errorMessage = e.getMessage();
        }

        return result;
    }

    /**
     * Create a ContentDocumentLink to associate content with a record.
     */
    private static void linkContentToRecord(Id contentDocumentId, Id linkedEntityId) {
        try {
            // Check if link already exists
            List<ContentDocumentLink> existing = [
                SELECT Id
                FROM ContentDocumentLink
                WHERE ContentDocumentId = :contentDocumentId
                AND LinkedEntityId = :linkedEntityId
                LIMIT 1
            ];

            if (existing.isEmpty()) {
                ContentDocumentLink link = new ContentDocumentLink();
                link.ContentDocumentId = contentDocumentId;
                link.LinkedEntityId = linkedEntityId;
                link.ShareType = 'V'; // Viewer permission
                link.Visibility = 'AllUsers';
                insert link;
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.WARN, '[linkContentToRecord] Could not link content: ' + e.getMessage());
        }
    }

    /**
     * Create a public URL for a ContentVersion using ContentDistribution.
     */
    private static String createPublicUrl(Id contentVersionId) {
        try {
            ContentVersion cv = [
                SELECT Id, ContentDocumentId, Title
                FROM ContentVersion
                WHERE Id = :contentVersionId
                LIMIT 1
            ];

            // Check for existing distribution
            List<ContentDistribution> existing = [
                SELECT Id, DistributionPublicUrl, ContentDownloadUrl
                FROM ContentDistribution
                WHERE ContentVersionId = :contentVersionId
                LIMIT 1
            ];

            if (!existing.isEmpty()) {
                return existing[0].ContentDownloadUrl;
            }

            // Create new distribution
            ContentDistribution cd = new ContentDistribution();
            cd.Name = cv.Title + ' Distribution';
            cd.ContentVersionId = contentVersionId;
            cd.PreferencesAllowViewInBrowser = true;
            cd.PreferencesLinkLatestVersion = true;
            cd.PreferencesNotifyOnVisit = false;
            cd.PreferencesPasswordRequired = false;
            cd.PreferencesAllowOriginalDownload = true;

            insert cd;

            cd = [
                SELECT Id, ContentDownloadUrl, DistributionPublicUrl
                FROM ContentDistribution
                WHERE Id = :cd.Id
                LIMIT 1
            ];

            return cd.ContentDownloadUrl;

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, '[createPublicUrl] Error: ' + e.getMessage());
            return null;
        }
    }

    /**
     * Get content details by ContentVersion ID.
     */
    @AuraEnabled(cacheable=true)
    public static ContentDetails getContentDetails(Id contentVersionId) {
        ContentDetails details = new ContentDetails();

        try {
            ContentVersion cv = [
                SELECT Id, Title, Description, ContentDocumentId, FileType,
                       ContentSize, CreatedDate, LastModifiedDate
                FROM ContentVersion
                WHERE Id = :contentVersionId
                LIMIT 1
            ];

            details.contentVersionId = cv.Id;
            details.contentDocumentId = cv.ContentDocumentId;
            details.title = cv.Title;
            details.description = cv.Description;
            details.fileType = cv.FileType;
            details.contentSize = cv.ContentSize;
            details.viewUrl = '/sfc/servlet.shepherd/version/renditionDownload?rendition=ORIGINAL_Html&versionId=' + cv.Id;
            details.downloadUrl = '/sfc/servlet.shepherd/version/download/' + cv.Id;
            details.recordUrl = '/' + cv.ContentDocumentId;

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, '[getContentDetails] Error: ' + e.getMessage());
        }

        return details;
    }

    /**
     * List all content in the MC Content Workspace.
     */
    @AuraEnabled(cacheable=true)
    public static List<ContentDetails> listMCWorkspaceContent(Integer limitCount) {
        List<ContentDetails> contentList = new List<ContentDetails>();
        Id workspaceId = getMCWorkspaceId();

        if (workspaceId == null) {
            return contentList;
        }

        try {
            List<ContentWorkspaceDoc> workspaceDocs = [
                SELECT ContentDocumentId
                FROM ContentWorkspaceDoc
                WHERE ContentWorkspaceId = :workspaceId
                LIMIT :limitCount
            ];

            Set<Id> docIds = new Set<Id>();
            for (ContentWorkspaceDoc doc : workspaceDocs) {
                docIds.add(doc.ContentDocumentId);
            }

            List<ContentVersion> versions = [
                SELECT Id, Title, Description, ContentDocumentId, FileType,
                       ContentSize, CreatedDate
                FROM ContentVersion
                WHERE ContentDocumentId IN :docIds
                AND IsLatest = true
                ORDER BY CreatedDate DESC
            ];

            for (ContentVersion cv : versions) {
                ContentDetails details = new ContentDetails();
                details.contentVersionId = cv.Id;
                details.contentDocumentId = cv.ContentDocumentId;
                details.title = cv.Title;
                details.description = cv.Description;
                details.fileType = cv.FileType;
                details.contentSize = cv.ContentSize;
                details.recordUrl = '/' + cv.ContentDocumentId;
                contentList.add(details);
            }

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, '[listMCWorkspaceContent] Error: ' + e.getMessage());
        }

        return contentList;
    }

    // ─── Result Classes ───────────────────────────────────────────────

    public class SaveContentResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String errorMessage;
        @AuraEnabled public Id contentVersionId;
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String contentUrl;
    }

    public class ContentDetails {
        @AuraEnabled public Id contentVersionId;
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String title;
        @AuraEnabled public String description;
        @AuraEnabled public String fileType;
        @AuraEnabled public Long contentSize;
        @AuraEnabled public String viewUrl;
        @AuraEnabled public String downloadUrl;
        @AuraEnabled public String recordUrl;
    }
}
