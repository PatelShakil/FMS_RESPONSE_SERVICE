/**
 * Export Controller
 * Handle data export requests (CSV, Excel, PDF)
 */

const Response = require('../models/Response');
const apiResponse = require('../utils/response');
const logger = require('../utils/logger');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');

class ExportController {
  /**
   * Export responses as CSV
   * GET /api/export/csv
   */
  async exportCSV(req, res) {
    try {
      const { formId, startDate, endDate, status } = req.query;

      logger.info('Exporting responses as CSV', {
        formId,
        startDate,
        endDate,
        status,
      });

      // Build query
      const query = { deletedAt: null };
      if (formId) query.formId = formId;
      if (status) query.status = status;

      // Validate org access
      if (!req.user.roles.includes('PLATFORM_ADMIN')) {
        query.orgId = req.user.orgId;
      }

      if (startDate || endDate) {
        query.submittedAt = {};
        if (startDate) query.submittedAt.$gte = new Date(startDate);
        if (endDate) query.submittedAt.$lte = new Date(endDate);
      }

      // Fetch responses (limit to prevent memory issues)
      const responses = await Response.find(query)
        .sort({ submittedAt: -1 })
        .limit(config.export.maxRecords)
        .lean();

      if (responses.length === 0) {
        return apiResponse.notFound(res, 'No responses found for export');
      }

      // Transform data for CSV
      const csvData = responses.map((response) => ({
        responseId: response.responseId,
        formId: response.formId,
        qrCodeId: response.qrCodeId || '',
        serviceId: response.serviceId,
        orgId: response.orgId,
        citizenEmail: response.citizenEmail || 'Anonymous',
        citizenPhone: response.citizenPhone || '',
        status: response.status,
        submittedAt: moment(response.submittedAt).format('YYYY-MM-DD HH:mm:ss'),
        location: response.location?.address || '',
        platform: response.device?.platform || '',
        isSpam: response.isSpam ? 'Yes' : 'No',
        spamScore: response.spamScore,
        replyCount: response.orgReplies?.length || 0,
        answers: JSON.stringify(response.answers),
      }));

      // Generate CSV
      const json2csvParser = new Parser({
        fields: [
          'responseId',
          'formId',
          'qrCodeId',
          'serviceId',
          'orgId',
          'citizenEmail',
          'citizenPhone',
          'status',
          'submittedAt',
          'location',
          'platform',
          'isSpam',
          'spamScore',
          'replyCount',
          'answers',
        ],
      });

      const csv = json2csvParser.parse(csvData);

      // Set headers for download
      const filename = `responses_${formId || 'all'}_${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      logger.info('CSV export completed', {
        formId,
        recordCount: responses.length,
      });

      return res.send(csv);
    } catch (error) {
      logger.error('Error in exportCSV controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Export responses as Excel
   * GET /api/export/excel
   */
  async exportExcel(req, res) {
    try {
      const { formId, startDate, endDate, status } = req.query;

      logger.info('Exporting responses as Excel', {
        formId,
        startDate,
        endDate,
        status,
      });

      // Build query
      const query = { deletedAt: null };
      if (formId) query.formId = formId;
      if (status) query.status = status;

      // Validate org access
      if (!req.user.roles.includes('PLATFORM_ADMIN')) {
        query.orgId = req.user.orgId;
      }

      if (startDate || endDate) {
        query.submittedAt = {};
        if (startDate) query.submittedAt.$gte = new Date(startDate);
        if (endDate) query.submittedAt.$lte = new Date(endDate);
      }

      // Fetch responses
      const responses = await Response.find(query)
        .sort({ submittedAt: -1 })
        .limit(config.export.maxRecords)
        .lean();

      if (responses.length === 0) {
        return apiResponse.notFound(res, 'No responses found for export');
      }

      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Responses');

      // Define columns
      worksheet.columns = [
        { header: 'Response ID', key: 'responseId', width: 20 },
        { header: 'Form ID', key: 'formId', width: 20 },
        { header: 'QR Code ID', key: 'qrCodeId', width: 20 },
        { header: 'Service ID', key: 'serviceId', width: 15 },
        { header: 'Organization ID', key: 'orgId', width: 15 },
        { header: 'Citizen Email', key: 'citizenEmail', width: 30 },
        { header: 'Citizen Phone', key: 'citizenPhone', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Submitted At', key: 'submittedAt', width: 20 },
        { header: 'Location', key: 'location', width: 30 },
        { header: 'Platform', key: 'platform', width: 15 },
        { header: 'Is Spam', key: 'isSpam', width: 10 },
        { header: 'Spam Score', key: 'spamScore', width: 12 },
        { header: 'Reply Count', key: 'replyCount', width: 12 },
        { header: 'Answers', key: 'answers', width: 50 },
      ];

      // Add rows
      responses.forEach((response) => {
        worksheet.addRow({
          responseId: response.responseId,
          formId: response.formId,
          qrCodeId: response.qrCodeId || '',
          serviceId: response.serviceId,
          orgId: response.orgId,
          citizenEmail: response.citizenEmail || 'Anonymous',
          citizenPhone: response.citizenPhone || '',
          status: response.status,
          submittedAt: moment(response.submittedAt).format('YYYY-MM-DD HH:mm:ss'),
          location: response.location?.address || '',
          platform: response.device?.platform || '',
          isSpam: response.isSpam ? 'Yes' : 'No',
          spamScore: response.spamScore,
          replyCount: response.orgReplies?.length || 0,
          answers: JSON.stringify(response.answers),
        });
      });

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' },
      };

      // Set headers for download
      const filename = `responses_${formId || 'all'}_${Date.now()}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      logger.info('Excel export completed', {
        formId,
        recordCount: responses.length,
      });

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      logger.error('Error in exportExcel controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }

  /**
   * Export responses as PDF
   * GET /api/export/pdf
   */
  async exportPDF(req, res) {
    try {
      const { formId, startDate, endDate, status } = req.query;

      logger.info('Exporting responses as PDF', {
        formId,
        startDate,
        endDate,
        status,
      });

      // Build query
      const query = { deletedAt: null };
      if (formId) query.formId = formId;
      if (status) query.status = status;

      // Validate org access
      if (!req.user.roles.includes('PLATFORM_ADMIN')) {
        query.orgId = req.user.orgId;
      }

      if (startDate || endDate) {
        query.submittedAt = {};
        if (startDate) query.submittedAt.$gte = new Date(startDate);
        if (endDate) query.submittedAt.$lte = new Date(endDate);
      }

      // Fetch responses (limit for PDF)
      const responses = await Response.find(query)
        .sort({ submittedAt: -1 })
        .limit(100) // PDF has smaller limit
        .lean();

      if (responses.length === 0) {
        return apiResponse.notFound(res, 'No responses found for export');
      }

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });

      // Set headers for download
      const filename = `responses_${formId || 'all'}_${Date.now()}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add title
      doc.fontSize(20).text('Response Export Report', { align: 'center' });
      doc.moveDown();

      // Add metadata
      doc.fontSize(12).text(`Form ID: ${formId || 'All Forms'}`, { align: 'left' });
      doc.text(`Export Date: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
      doc.text(`Total Responses: ${responses.length}`);
      doc.moveDown();

      // Add responses
      responses.forEach((response, index) => {
        if (index > 0) {
          doc.addPage();
        }

        doc.fontSize(14).text(`Response #${index + 1}`, { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10);
        doc.text(`Response ID: ${response.responseId}`);
        doc.text(`Form ID: ${response.formId}`);
        doc.text(`Status: ${response.status}`);
        doc.text(`Submitted: ${moment(response.submittedAt).format('YYYY-MM-DD HH:mm:ss')}`);
        doc.text(`Citizen: ${response.citizenEmail || 'Anonymous'}`);
        doc.text(`Platform: ${response.device?.platform || 'Unknown'}`);
        doc.moveDown();

        doc.text('Answers:', { underline: true });
        doc.text(JSON.stringify(response.answers, null, 2));

        if (response.orgReplies && response.orgReplies.length > 0) {
          doc.moveDown();
          doc.text('Replies:', { underline: true });
          response.orgReplies.forEach((reply, idx) => {
            doc.text(`${idx + 1}. ${reply.message} (by ${reply.repliedByEmail})`);
          });
        }
      });

      // Finalize PDF
      doc.end();

      logger.info('PDF export completed', {
        formId,
        recordCount: responses.length,
      });
    } catch (error) {
      logger.error('Error in exportPDF controller:', error);
      return apiResponse.serverError(res, error.message);
    }
  }
}

module.exports = new ExportController();
