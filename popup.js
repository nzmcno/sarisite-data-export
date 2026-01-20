// popup.js - Sahibinden CSV Exporter with Image Download Feature
// Professional Chrome Extension for exporting classified ads to CSV and downloading images

/**
 * ============================================================================
 * TAB NAVIGATION
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  // Tab switching functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Remove active class from all tabs and buttons
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
});

/**
 * ============================================================================
 * CSV DOWNLOAD FUNCTIONALITY
 * ============================================================================
 */
document.getElementById("downloadCsvBtn").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractAndDownloadCSV
    });
  } catch (error) {
    console.error('Error executing script:', error);
    alert('Script çalıştırılamadı. Lütfen sayfayı yenileyin ve tekrar deneyin.');
  }
});

/**
 * Main extraction function - extracts classified ads data and downloads as CSV
 * This function runs in the context of the sahibinden.com page
 */
function extractAndDownloadCSV() {
  try {
    const rows = document.querySelectorAll("#searchResultsTable tbody tr[data-id]");
    
    if (rows.length === 0) {
      alert('Sayfa üzerinde ilan bulunamadı.');
      return;
    }

    // Başlıkları otomatik olarak thead'den al
    const headerCells = document.querySelectorAll("#searchResultsTable thead tr td");
    const headers = [];
    
    headerCells.forEach((cell, index) => {
      if (index === 0) {
        headers.push("Resim");
      } else {
        // ignore sütunlarını atla
        if (cell.classList.contains('searchResultsIgnoredColumn') || 
            cell.classList.contains('ignore-me') ||
            cell.innerText.trim() === "" ||
            cell.innerText.trim() === "&nbsp;") {
          return;
        }
        
        // Diğer başlıkları al, link içindeki metni tercih et
        const linkText = cell.querySelector("a")?.innerText.trim();
        const cellText = cell.innerText.trim();
        const headerText = linkText || cellText || `Sütun ${index}`;
        
        // Boş veya çok kısa başlıkları filtrele
        if (headerText.length > 1 && headerText !== "&nbsp;") {
          headers.push(headerText);
        }
      }
    });
    
    // Link sütununu da ekle
    headers.push("İlan Linki");
    
    const csv = [headers];

    rows.forEach(row => {
      const rowData = [];
      
      // 1. Resim linkini al (her zaman var)
      const imgElement = row.querySelector(".searchResultsLargeThumbnail img");
      const imageUrl = imgElement ? imgElement.src : "";
      rowData.push(imageUrl);
      
      // 2. Dinamik olarak tüm sütunları al
      const allCells = row.querySelectorAll("td");
      
      allCells.forEach((cell, index) => {
        // İlk sütun resim, son sütun ignore butonları - bunları atla
        if (index === 0 || cell.classList.contains('ignore-me') || cell.classList.contains('searchResultsIgnoredColumn')) {
          return;
        }
        
        let cellValue = "";
        
        // Özel durumlar için kontrol et
        if (cell.classList.contains('searchResultsTitleValue')) {
          // İlan başlığı
          const titleElement = cell.querySelector(".classifiedTitle");
          cellValue = titleElement?.innerText.trim() || "";
        } else if (cell.classList.contains('searchResultsPriceValue')) {
          // Fiyat
          const priceElement = cell.querySelector("span") || cell.querySelector(".classified-price-container span");
          cellValue = priceElement?.innerText.trim().replace(/\./g, '').replace(' TL', '') || "";
        } else if (cell.classList.contains('searchResultsDateValue')) {
          // Tarih
          const spans = cell.querySelectorAll("span");
          if (spans.length >= 2) {
            cellValue = `${spans[0].innerText.trim()} ${spans[1].innerText.trim()}`;
          } else {
            cellValue = cell.innerText.trim();
          }
        } else if (cell.classList.contains('searchResultsLocationValue')) {
          // Konum - br etiketi varsa '/' ile birleştir
          const locationText = cell.innerText.trim();
          const brElement = cell.querySelector('br');
          
          if (brElement) {
            // br etiketi var - '/' ile birleştir
            const parts = locationText.split('\n').filter(part => part.trim() !== '');
            if (parts.length >= 2) {
              cellValue = `${parts[0].trim()} / ${parts[1].trim()}`;
            } else {
              cellValue = locationText;
            }
          } else {
            // br etiketi yok - direkt al
            cellValue = locationText;
          }
        } else {
          // Genel durumlar - direkt text al
          cellValue = cell.innerText.trim();
        }
        
        rowData.push(cellValue);
      });
      
      // İlan linkini son sütun olarak ekle
      const titleElement = row.querySelector(".classifiedTitle");
      const ilanLink = titleElement?.href ? (titleElement.href.startsWith('http') ? titleElement.href : 'https://www.sahibinden.com' + titleElement.href) : "";
      rowData.push(ilanLink);
      
      csv.push(rowData);
    });

    // CSV formatını düzgün şekilde oluştur - her hücreyi tırnak içine al ve noktalı virgül kullan
    const csvContent = csv.map(row => 
      row.map(cell => {
        // Boş değerleri kontrol et
        const cellValue = String(cell || "");
        // Çift tırnakları escape et ve her hücreyi tırnak içine al
        return `"${cellValue.replace(/"/g, '""')}"`;
      }).join(";")  // Noktalı virgül kullan (Türkiye Excel standardı)
    ).join("\n");
    
    // BOM ekleyerek UTF-8 formatını belirt
    const csvWithBOM = "\uFEFF" + csvContent;
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sahibinden_ilanlar.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error during extraction:', error);
    alert('Veri çıkarılırken bir hata oluştu. Lütfen sayfayı yenileyin ve tekrar deneyin.');
  }
}

/**
 * ============================================================================
 * IMAGE DOWNLOAD FUNCTIONALITY
 * ============================================================================
 */

/**
 * Scan Images Button - Starts the image scanning process
 */
document.getElementById("scanImagesBtn").addEventListener("click", async () => {
  const scanButton = document.getElementById("scanImagesBtn");
  const emptyState = document.getElementById("emptyState");
  const imageResults = document.getElementById("imageResults");
  
  try {
    // Show loading state
    scanButton.disabled = true;
    scanButton.innerHTML = '<span class="loading-spinner"></span> Taranıyor...';
    emptyState.style.display = 'none';
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Execute image scanning script in the page context
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: scanPageForImages
    });
    
    const imageGroups = results[0].result;
    
    // Display results
    displayImageGroups(imageGroups);
    imageResults.style.display = 'block';
    
    // Reset button
    scanButton.disabled = false;
    scanButton.innerHTML = '🔍 Sayfayı Tara';
    
  } catch (error) {
    console.error('Error scanning images:', error);
    alert('Görsel tarama sırasında bir hata oluştu.');
    scanButton.disabled = false;
    scanButton.innerHTML = '🔍 Sayfayı Tara';
    emptyState.style.display = 'block';
  }
});

/**
 * Scan page for images - Runs in page context
 * Finds all IMG elements and background images, groups them by size and type
 */
function scanPageForImages() {
  console.log('Starting image scan...');
  
  const imageMap = new Map(); // To avoid duplicates
  const imageGroups = {};
  
  // =========================================================================
  // STEP 1: Find all IMG elements
  // =========================================================================
  const imgElements = document.querySelectorAll('img');
  console.log(`Found ${imgElements.length} img elements`);
  
  imgElements.forEach((img, index) => {
    const imageUrl = img.src;
    
    // Skip if no URL or already processed
    if (!imageUrl || !imageUrl.startsWith('http') || imageMap.has(imageUrl)) {
      return;
    }
    
    // Get rendered dimensions
    const renderedWidth = img.offsetWidth;
    const renderedHeight = img.offsetHeight;
    
    // Skip tiny or hidden images
    if (renderedWidth === 0 || renderedHeight === 0) {
      return;
    }
    
    // Get natural dimensions
    const actualWidth = img.naturalWidth;
    const actualHeight = img.naturalHeight;
    
    // Get image type from URL
    const urlParts = imageUrl.split('.');
    const extension = urlParts[urlParts.length - 1].split(/[?#]/)[0].toLowerCase();
    const imageType = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(extension) 
      ? extension 
      : 'unknown';
    
    // Create image object
    const imageData = {
      url: imageUrl,
      alt: img.alt || '',
      renderedWidth,
      renderedHeight,
      actualWidth,
      actualHeight,
      type: imageType
    };
    
    // Mark as processed
    imageMap.set(imageUrl, true);
    
    // =========================================================================
    // Group images by rendered dimensions and type
    // =========================================================================
    const groupKey = `${Math.round(renderedWidth)}x${Math.round(renderedHeight)}-${imageType}`;
    
    if (!imageGroups[groupKey]) {
      imageGroups[groupKey] = {
        renderedDimensions: `${Math.round(renderedWidth)}×${Math.round(renderedHeight)}`,
        actualDimensions: new Set(),
        type: imageType,
        images: []
      };
    }
    
    imageGroups[groupKey].images.push(imageData);
    imageGroups[groupKey].actualDimensions.add(`${actualWidth}×${actualHeight}`);
  });
  
  // =========================================================================
  // STEP 2: Find background images (CSS)
  // =========================================================================
  const allElements = document.querySelectorAll('*');
  console.log(`Checking ${allElements.length} elements for background images...`);
  
  let bgImageCount = 0;
  allElements.forEach(element => {
    const computedStyle = window.getComputedStyle(element);
    const backgroundImage = computedStyle.backgroundImage;
    
    // Check if element has background image
    if (backgroundImage && backgroundImage !== 'none') {
      // Extract URL from background-image CSS property
      // Format: url("https://example.com/image.jpg") or url('...')
      const urlMatch = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
      
      if (urlMatch && urlMatch[1]) {
        const imageUrl = urlMatch[1];
        
        // Skip if already processed or not a valid HTTP URL
        if (!imageUrl.startsWith('http') || imageMap.has(imageUrl)) {
          return;
        }
        
        // Get element dimensions
        const renderedWidth = element.offsetWidth;
        const renderedHeight = element.offsetHeight;
        
        // Skip tiny or hidden elements
        if (renderedWidth === 0 || renderedHeight === 0) {
          return;
        }
        
        // Get image type from URL
        const urlParts = imageUrl.split('.');
        const extension = urlParts[urlParts.length - 1].split(/[?#]/)[0].toLowerCase();
        const imageType = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(extension)
          ? extension
          : 'unknown';
        
        // For background images, we don't know natural dimensions until loaded
        // So we'll use rendered dimensions as a placeholder
        const imageData = {
          url: imageUrl,
          alt: 'Background Image',
          renderedWidth,
          renderedHeight,
          actualWidth: renderedWidth, // Placeholder
          actualHeight: renderedHeight, // Placeholder
          type: imageType,
          isBackgroundImage: true
        };
        
        // Mark as processed
        imageMap.set(imageUrl, true);
        bgImageCount++;
        
        // Group by dimensions and type
        const groupKey = `${Math.round(renderedWidth)}x${Math.round(renderedHeight)}-${imageType}`;
        
        if (!imageGroups[groupKey]) {
          imageGroups[groupKey] = {
            renderedDimensions: `${Math.round(renderedWidth)}×${Math.round(renderedHeight)}`,
            actualDimensions: new Set(),
            type: imageType,
            images: []
          };
        }
        
        imageGroups[groupKey].images.push(imageData);
        imageGroups[groupKey].actualDimensions.add(`${renderedWidth}×${renderedHeight}`);
      }
    }
  });
  
  console.log(`Found ${bgImageCount} background images`);
  
  // =========================================================================
  // STEP 3: Sort and format groups
  // =========================================================================
  
  // Convert actualDimensions Set to Array for serialization
  Object.keys(imageGroups).forEach(key => {
    imageGroups[key].actualDimensions = Array.from(imageGroups[key].actualDimensions);
  });
  
  // Sort groups by image count (descending) and size (descending)
  const sortedGroups = {};
  Object.keys(imageGroups)
    .sort((a, b) => {
      const groupA = imageGroups[a];
      const groupB = imageGroups[b];
      
      // First, prioritize groups with multiple images
      if (groupA.images.length !== groupB.images.length) {
        return groupB.images.length - groupA.images.length;
      }
      
      // Then sort by rendered size (width * height)
      const [widthA, heightA] = a.split('x')[0].split('×').map(Number);
      const [widthB, heightB] = b.split('x')[0].split('×').map(Number);
      const sizeA = widthA * heightA;
      const sizeB = widthB * heightB;
      
      return sizeB - sizeA;
    })
    .forEach(key => {
      sortedGroups[key] = imageGroups[key];
    });
  
  console.log(`Image scan complete. Found ${Object.keys(sortedGroups).length} groups.`);
  
  return sortedGroups;
}

/**
 * Display image groups in the popup UI
 */
function displayImageGroups(imageGroups) {
  const statsDiv = document.getElementById('imageStats');
  const containerDiv = document.getElementById('imageGroupsContainer');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  
  // Calculate total images
  let totalImages = 0;
  Object.values(imageGroups).forEach(group => {
    totalImages += group.images.length;
  });
  
  // Update stats
  statsDiv.innerHTML = `
    <strong>${totalImages}</strong> görsel bulundu 
    (<strong>${Object.keys(imageGroups).length}</strong> grup)
  `;
  
  // Setup download all button
  downloadAllBtn.onclick = () => downloadAllImages(imageGroups);
  downloadAllBtn.disabled = totalImages === 0;
  
  // Clear previous results
  containerDiv.innerHTML = '';
  
  // If no images found
  if (totalImages === 0) {
    containerDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <p>Sayfada görsel bulunamadı</p>
      </div>
    `;
    return;
  }
  
  // Create group elements
  Object.entries(imageGroups).forEach(([groupKey, groupData]) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'image-group';
    
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header';
    
    const groupInfo = document.createElement('div');
    groupInfo.className = 'group-info';
    groupInfo.innerHTML = `
      <div class="group-title">${groupData.renderedDimensions} (${groupData.type.toUpperCase()})</div>
      <div>${groupData.images.length} görsel</div>
    `;
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'download-group-btn';
    downloadButton.textContent = '⬇️ İndir';
    downloadButton.onclick = () => downloadImageGroup(groupData.images, groupKey);
    
    groupHeader.appendChild(groupInfo);
    groupHeader.appendChild(downloadButton);
    
    // Create image grid (show first 8 images)
    const imageGrid = document.createElement('div');
    imageGrid.className = 'image-grid';
    
    const imagesToShow = groupData.images.slice(0, 8);
    imagesToShow.forEach((imageData, index) => {
      const imageItem = document.createElement('div');
      imageItem.className = 'image-item';
      
      const img = document.createElement('img');
      img.src = imageData.url;
      img.alt = imageData.alt || 'Image';
      img.title = `${imageData.actualWidth}×${imageData.actualHeight}`;
      
      const singleDownloadBtn = document.createElement('button');
      singleDownloadBtn.className = 'download-single-btn';
      singleDownloadBtn.textContent = '⬇️';
      singleDownloadBtn.title = 'Bu görseli indir';
      singleDownloadBtn.onclick = (e) => {
        e.stopPropagation();
        downloadSingleImage(imageData);
      };
      
      imageItem.appendChild(img);
      imageItem.appendChild(singleDownloadBtn);
      imageGrid.appendChild(imageItem);
    });
    
    // Show "more" indicator if there are more than 8 images
    if (groupData.images.length > 8) {
      const moreDiv = document.createElement('div');
      moreDiv.className = 'image-item';
      moreDiv.style.background = 'rgba(255, 215, 0, 0.2)';
      moreDiv.style.display = 'flex';
      moreDiv.style.alignItems = 'center';
      moreDiv.style.justifyContent = 'center';
      moreDiv.style.fontWeight = 'bold';
      moreDiv.style.fontSize = '14px';
      moreDiv.style.color = '#FF6B00';
      moreDiv.textContent = `+${groupData.images.length - 8}`;
      imageGrid.appendChild(moreDiv);
    }
    
    groupDiv.appendChild(groupHeader);
    groupDiv.appendChild(imageGrid);
    containerDiv.appendChild(groupDiv);
  });
}

/**
 * Download a single image
 */
async function downloadSingleImage(imageData) {
  try {
    // Get hostname for filename
    const hostname = window.location.hostname.replace('www.', '');
    
    // Get file extension
    const extension = imageData.type !== 'unknown' ? imageData.type : 'jpg';
    
    // Create filename with timestamp
    const timestamp = Date.now();
    const filename = `${hostname}_image_${timestamp}.${extension}`;
    
    // Use Chrome downloads API
    await chrome.downloads.download({
      url: imageData.url,
      filename: filename,
      saveAs: false
    });
    
    console.log(`Downloaded: ${filename}`);
    
  } catch (error) {
    console.error('Error downloading image:', error);
    alert('Görsel indirilirken bir hata oluştu.');
  }
}

/**
 * Download all images in a group
 */
async function downloadImageGroup(images, groupKey) {
  try {
    // Get hostname for folder name
    const hostname = window.location.hostname.replace('www.', '');
    const timestamp = Math.floor(Date.now() / 1000);
    const folderName = `${hostname}_images_${timestamp}`;
    
    // Batch download with delay to avoid overwhelming the browser
    const BATCH_SIZE = 5;
    const DELAY_MS = 300;
    
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      
      // Download batch
      await Promise.all(batch.map(async (imageData, batchIndex) => {
        const index = i + batchIndex;
        const extension = imageData.type !== 'unknown' ? imageData.type : 'jpg';
        
        // Clean filename
        const filename = `${folderName}/${timestamp}_${index}.${extension}`;
        
        try {
          await chrome.downloads.download({
            url: imageData.url,
            filename: filename,
            saveAs: false
          });
        } catch (err) {
          console.error(`Error downloading image ${index}:`, err);
        }
      }));
      
      // Wait before next batch
      if (i + BATCH_SIZE < images.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    console.log(`Downloaded ${images.length} images to folder: ${folderName}`);
    alert(`${images.length} görsel indirildi!`);
    
  } catch (error) {
    console.error('Error downloading image group:', error);
    alert('Görseller indirilirken bir hata oluştu.');
  }
}

/**
 * Download all images from all groups
 */
async function downloadAllImages(imageGroups) {
  try {
    // Collect all images from all groups
    const allImages = [];
    Object.values(imageGroups).forEach(group => {
      allImages.push(...group.images);
    });
    
    if (allImages.length === 0) {
      alert('İndirilecek görsel bulunamadı.');
      return;
    }
    
    // Confirm with user
    const confirmed = confirm(`Toplam ${allImages.length} görsel indirilecek. Devam etmek istiyor musunuz?`);
    if (!confirmed) {
      return;
    }
    
    // Disable button during download
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const originalText = downloadAllBtn.innerHTML;
    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = '<span class="loading-spinner"></span> İndiriliyor...';
    
    // Get hostname for folder name
    const hostname = window.location.hostname.replace('www.', '');
    const timestamp = Math.floor(Date.now() / 1000);
    const folderName = `${hostname}_all_images_${timestamp}`;
    
    // Batch download with delay
    const BATCH_SIZE = 5;
    const DELAY_MS = 300;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
      const batch = allImages.slice(i, i + BATCH_SIZE);
      
      // Download batch
      const results = await Promise.allSettled(
        batch.map(async (imageData, batchIndex) => {
          const index = i + batchIndex;
          const extension = imageData.type !== 'unknown' ? imageData.type : 'jpg';
          const filename = `${folderName}/${timestamp}_${index}.${extension}`;
          
          return chrome.downloads.download({
            url: imageData.url,
            filename: filename,
            saveAs: false
          });
        })
      );
      
      // Count results
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
          console.error('Download failed:', result.reason);
        }
      });
      
      // Update button text with progress
      const progress = Math.round(((i + batch.length) / allImages.length) * 100);
      downloadAllBtn.innerHTML = `<span class="loading-spinner"></span> ${progress}% (${i + batch.length}/${allImages.length})`;
      
      // Wait before next batch
      if (i + BATCH_SIZE < allImages.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    // Reset button
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = originalText;
    
    // Show result
    if (errorCount > 0) {
      alert(`${successCount} görsel başarıyla indirildi, ${errorCount} hata oluştu.`);
    } else {
      alert(`Tüm görseller başarıyla indirildi! (${successCount} görsel)`);
    }
    
    console.log(`Downloaded all images. Success: ${successCount}, Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Error downloading all images:', error);
    alert('Görseller indirilirken bir hata oluştu.');
    
    // Reset button on error
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = '⬇️ Hepsini İndir';
  }
}
