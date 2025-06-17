// popup.js - Sahibinden CSV Exporter
// Professional Chrome Extension for exporting classified ads to CSV

/**
 * Main popup script - handles user interaction
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


