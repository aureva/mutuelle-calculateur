# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a French web application called "Mutuelle Calculateur" that helps users analyze their health insurance reimbursements from their PDF documents. The app determines if users are financially gaining or losing money with their "mutuelle" (French supplementary health insurance).

## Architecture

This is a client-side single-page application built with vanilla HTML, CSS, and JavaScript:

- **Frontend**: Pure JavaScript with no frameworks
- **PDF Processing**: PDF.js library for text extraction from PDF documents
- **Charts**: Chart.js for data visualization
- **PDF Generation**: jsPDF for creating downloadable reports
- **Data Storage**: Supabase for anonymous analytics data collection
- **Styling**: Custom CSS with responsive design

## Core Functionality

The application processes PDF documents from French health insurance companies ("mutuelles") to:
1. Extract reimbursement data using regex patterns for different insurance providers
2. Calculate financial balance between premiums paid and reimbursements received
3. Generate charts and reports showing yearly analysis
4. Allow users to input their contribution data for accurate calculations

## Key Files

- `index.html` - Main application UI with tabs for reimbursements, premiums, and analytics
- `script.js` - Core application logic including PDF processing, data analysis, and chart generation
- `style.css` - Responsive styling with mobile-first approach
- Legal pages: `cgu.html`, `confidentialite.html`, `mentions.html`, `contact.html`

## Development Notes

- **PDF Processing**: The app uses multiple regex patterns to handle different French insurance company formats (Harmonie Mutuelle, MGEN, etc.)
- **Data Privacy**: All processing is done client-side; only anonymized statistics are optionally sent to Supabase
- **Responsive Design**: Mobile-first CSS with extensive media queries for different screen sizes
- **French Language**: All UI text and error messages are in French

## Testing

Since this is a client-side application, test by:
1. Opening `index.html` in a browser
2. Using sample PDF files from French insurance companies
3. Verifying data extraction and calculations
4. Testing responsive design on different screen sizes

## Configuration

Supabase configuration is hardcoded in `script.js` (lines 40-43). The app gracefully handles Supabase unavailability.