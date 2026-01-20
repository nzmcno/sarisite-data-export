// background.js - Service Worker for Sahibinden Extension
// Handles download permissions and background tasks

/**
 * ============================================================================
 * EXTENSION INSTALLATION
 * ============================================================================
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Sahibinden İlan Veri İndirici extension installed successfully!');
});

/**
 * ============================================================================
 * MESSAGE HANDLER
 * ============================================================================
 * Listens for messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Handle image download requests
  if (message.action === 'download-images') {
    handleImageDownload(message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ status: 'error', error: error.message }));
    
    // Return true to indicate async response
    return true;
  }
  
  // Handle single image download
  if (message.action === 'download-single-image') {
    handleSingleImageDownload(message.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ status: 'error', error: error.message }));
    
    return true;
  }
});

/**
 * ============================================================================
 * IMAGE DOWNLOAD HANDLERS
 * ============================================================================
 */

/**
 * Handle batch image download
 */
async function handleImageDownload(data) {
  const { images, folder } = data;
  
  if (!images || images.length === 0) {
    return { status: 'error', error: 'No images to download' };
  }
  
  console.log(`Starting batch download of ${images.length} images to folder: ${folder}`);
  
  try {
    // Check if downloads permission is granted
    const hasPermission = await chrome.permissions.contains({
      permissions: ['downloads']
    });
    
    if (!hasPermission) {
      // Request permission if not granted
      const granted = await chrome.permissions.request({
        permissions: ['downloads']
      });
      
      if (!granted) {
        return { status: 'error', error: 'Downloads permission denied' };
      }
    }
    
    // Download images in batches
    const BATCH_SIZE = 10;
    const BATCH_DELAY = 500; // ms between batches
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      
      // Process batch
      const batchResults = await Promise.allSettled(
        batch.map(async (imageUrl, batchIndex) => {
          const index = i + batchIndex;
          
          // Get file extension from URL
          const urlParts = imageUrl.split('.');
          const extension = urlParts[urlParts.length - 1]
            .split(/[?#]/)[0]
            .toLowerCase() || 'jpg';
          
          // Create sanitized filename
          const timestamp = Date.now();
          const filename = `${folder}/${timestamp}_${index}.${extension}`;
          
          // Download file
          return chrome.downloads.download({
            url: imageUrl,
            filename: filename,
            saveAs: false
          });
        })
      );
      
      // Count successes and errors
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
          console.error('Download failed:', result.reason);
        }
      });
      
      // Wait before next batch
      if (i + BATCH_SIZE < images.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }
    
    console.log(`Batch download complete. Success: ${successCount}, Errors: ${errorCount}`);
    
    return {
      status: 'success',
      successCount,
      errorCount,
      totalImages: images.length
    };
    
  } catch (error) {
    console.error('Error in batch download:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Handle single image download
 */
async function handleSingleImageDownload(data) {
  const { url, filename } = data;
  
  try {
    // Check if downloads permission is granted
    const hasPermission = await chrome.permissions.contains({
      permissions: ['downloads']
    });
    
    if (!hasPermission) {
      // Request permission if not granted
      const granted = await chrome.permissions.request({
        permissions: ['downloads']
      });
      
      if (!granted) {
        return { status: 'error', error: 'Downloads permission denied' };
      }
    }
    
    // Download file
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false
    });
    
    console.log(`Single image downloaded. Download ID: ${downloadId}`);
    
    return {
      status: 'success',
      downloadId
    };
    
  } catch (error) {
    console.error('Error downloading single image:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Sanitize filename - remove invalid characters
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9._-]/gi, '_').toLowerCase();
}
