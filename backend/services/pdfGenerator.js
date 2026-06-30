const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')

/**
 * Generate a PDF buffer from an array of phone numbers.
 */
async function generatePdf(phones) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Courier)
  const fontSize = 11
  const margin = 50
  const lineHeight = fontSize + 6
  const pageHeight = 792
  const pageWidth = 612
  const linesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight)

  for (let i = 0; i < phones.length; i += linesPerPage) {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    const chunk = phones.slice(i, i + linesPerPage)
    chunk.forEach((phone, idx) => {
      page.drawText(phone, {
        x: margin,
        y: pageHeight - margin - idx * lineHeight,
        size: fontSize,
        font,
        color: rgb(0.9, 0.9, 0.9),
      })
    })
  }

  return pdfDoc.save()
}

module.exports = { generatePdf }
