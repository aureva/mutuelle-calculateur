// Configuration PDF.js avec HTTPS
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        
        // Supprimer tous les warnings PDF.js de la console
        const originalWarn = console.warn;
        const originalLog = console.log;
        
        console.warn = function(message) {
            if (message && (
                message.toString().includes('Setting up fake worker') ||
                message.toString().includes('pdf.worker') ||
                message.toString().includes('Worker')
            )) {
                return;
            }
            originalWarn.apply(console, arguments);
        };
        
        console.log = function(message) {
            if (message && (
                message.toString().includes('Setting up fake worker') ||
                message.toString().includes('pdf.worker')
            )) {
                return;
            }
            originalLog.apply(console, arguments);
        };
        
        // Variables globales
        let analysisData = null;
        let cotisationsData = {};
        let currentSortOrder = 'desc';
        let charts = {};
        let supabaseClient = null;
        let extractedTextForDebug = '';

        // Configuration Supabase fixe
        const SUPABASE_CONFIG = {
            url: 'https://ztzutnphaugpnbwhczvq.supabase.co',
            key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0enV0bnBoYXVncG5id2hjenZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MzA2MTYsImV4cCI6MjA3MjIwNjYxNn0.VSLWSbqyE_FFGx00qXqRA-9rW0POwFlQxnjgs2yBl-c'
        };

        // Initialisation automatique de Supabase au chargement
        document.addEventListener('DOMContentLoaded', function() {
            initSupabase();
        });

        function initSupabase() {
            try {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
                script.onload = function() {
                    if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.key) {
                        supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
                        console.log('Supabase initialisé');
                    }
                };
                document.head.appendChild(script);
            } catch (error) {
                console.error('Erreur lors de l\'initialisation de Supabase:', error);
            }
        }

        function checkConsentAndDownload() {
            const consentCheckbox = document.getElementById('dataConsent');
            
            if (!consentCheckbox.checked) {
                alert('⚠️ Vous devez accepter le partage anonyme des données pour télécharger le rapport complet.\n\nCela nous aide à améliorer le service pour tous les utilisateurs.');
                consentCheckbox.focus();
                return;
            }

            saveDataToSupabase().then(() => {
                downloadAllChartsAsPDF();
            }).catch((error) => {
                console.error('Erreur lors de la sauvegarde:', error);
                downloadAllChartsAsPDF();
            });
        }

        // Structure des données pour Supabase
        function prepareDataForSupabase() {
            if (!analysisData || Object.keys(cotisationsData).length === 0) {
                return null;
            }

            const dataToSave = {
                mutuelle_name: analysisData.mutuelle || 'Non identifiée',
                created_at: new Date().toISOString(),
                years_data: {}
            };

            Object.keys(cotisationsData).forEach(year => {
                const yearData = cotisationsData[year];
                const analysisYearData = analysisData.totalByYear[year] || { mutuelle: 0, secu: 0 };
                
                const reimbursementsThisYear = [
                    ...analysisData.reimbursements,
                    ...analysisData.pharmacyPayments
                ].filter(item => item.date && item.date.endsWith('/' + year));

                dataToSave.years_data[year] = {
                    nombre_remboursements: reimbursementsThisYear.length,
                    cotisation_personnelle: yearData.votreCotisationAnnuelle || 0,
                    contribution_employeur: yearData.employeurAnnuel || 0,
                    bilan: yearData.deficit || 0,
                    total_remboursement_mutuelle: analysisYearData.mutuelle || 0,
                    total_remboursement_secu: analysisYearData.secu || 0
                };
            });

            return dataToSave;
        }

        async function saveDataToSupabase() {
            if (!supabaseClient) {
                return Promise.reject(new Error('Supabase non disponible'));
            }

            const dataToSave = prepareDataForSupabase();
            if (!dataToSave) {
                return Promise.reject(new Error('Aucune donnée disponible'));
            }

            try {
                const { data, error } = await supabaseClient
                    .from('mutuelle_data')
                    .insert([dataToSave]);

                if (error) {
                    throw error;
                }
                return Promise.resolve(data);
            } catch (error) {
                return Promise.reject(error);
            }
        }

        // Gestion du drag & drop
        function handleDragOver(e) {
            e.preventDefault();
            e.currentTarget.classList.add('dragover');
        }

        function handleDragLeave(e) {
            e.preventDefault();
            e.currentTarget.classList.remove('dragover');
        }

        function handleDrop(e) {
            e.preventDefault();
            e.currentTarget.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/pdf') {
                processFile(files[0]);
            }
        }

        function handleFileSelect(e) {
            const file = e.target.files[0];
            if (file && file.type === 'application/pdf') {
                processFile(file);
            }
        }

        async function processFile(file) {
            showLoading();
            
            try {
                const text = await extractTextFromPDF(file);
                extractedTextForDebug = text; // Store for debugging
                analysisData = await analyzeDocument(text);
                displayResults(analysisData);
            } catch (error) {
                showError('Erreur lors du traitement du fichier: ' + error.message);
            } finally {
                hideLoading();
            }
        }

        async function extractTextFromPDF(file) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }

            return fullText;
        }

        function parseAmount(str) {
            if (!str) return 0;
            // Remove all non-digit characters except comma and dot
            const cleaned = str.toString().replace(/[^\d,.-]/g, '');
            // Replace comma with dot for decimal parsing
            const normalized = cleaned.replace(',', '.');
            return parseFloat(normalized) || 0;
        }

        function parseDate(dateStr) {
            if (!dateStr) return null;
            // Try different date formats
            const patterns = [
                /(\d{2})\/(\d{2})\/(\d{4})/,  // DD/MM/YYYY
                /(\d{2})-(\d{2})-(\d{4})/,   // DD-MM-YYYY
                /(\d{4})-(\d{2})-(\d{2})/,   // YYYY-MM-DD
                /(\d{2})\.(\d{2})\.(\d{4})/  // DD.MM.YYYY
            ];
            
            for (const pattern of patterns) {
                const match = dateStr.match(pattern);
                if (match) {
                    if (match[1].length === 4) {
                        // YYYY-MM-DD format
                        return `${match[3]}/${match[2]}/${match[1]}`;
                    } else {
                        // DD/MM/YYYY format
                        return `${match[1]}/${match[2]}/${match[3]}`;
                    }
                }
            }
            return dateStr; // Return original if no pattern matches
        }

        async function analyzeDocument(text) {
            const data = {
                beneficiary: '',
                mutuelle: '',
                period: '',
                totalReimbursements: 0,
                totalMutuelle: 0,
                totalSecu: 0,
                reimbursements: [],
                pharmacyPayments: [],
                totalByYear: {},
                totalByMonth: {}
            };

            console.log("Analyse du texte PDF (premiers 2000 caractères):", text.substring(0, 2000));

            // Improved beneficiary extraction
            const namePatterns = [
                /([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
                /Nom[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
                /Bénéficiaire[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
                /Assuré[:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
                /M\.|Mme\.?\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i
            ];
            
            for (const pattern of namePatterns) {
                const matches = text.match(pattern);
                if (matches && matches[0]) {
                    data.beneficiary = matches[0].replace(/^(Nom|Bénéficiaire|Assuré)[:\s]+/i, '').trim();
                    console.log("Bénéficiaire trouvé:", data.beneficiary);
                    break;
                }
            }

            // Enhanced mutuelle detection
            const mutuellePatterns = [
                /Harmonie[\s-]?Mutuelle/gi,
                /MGEN/gi,
                /Mutuelle[\s-]?Générale/gi,
                /MNT/gi,
                /(MAAF|MAIF|MACIF)[\s-]?[Ss]anté/gi,
                /Malakoff[\s-]?Humanis/gi,
                /AXA[\s-]?Santé/gi,
                /Groupama/gi,
                /MATMUT/gi,
                /Mutex/gi,
                /Allianz[\s-]?Santé/gi,
                /April/gi,
                /Swiss[\s-]?Life/gi,
                /Generali/gi,
                /Henner/gi,
                /VYV/gi,
                /EOVI[\s-]?MCD/gi,
                /Mutuelle[\s-]?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
                /([A-Z][a-z]+)[\s-]?Mutuelle/gi
            ];
            
            for (const pattern of mutuellePatterns) {
                const match = text.match(pattern);
                if (match && match[0]) {
                    data.mutuelle = match[0].trim();
                    console.log("Mutuelle trouvée:", data.mutuelle);
                    break;
                }
            }

            // Enhanced period extraction
            const periodPatterns = [
                /Période\s+du\s+(\d{2}\/\d{2}\/\d{4})\s+au\s+(\d{2}\/\d{2}\/\d{4})/i,
                /Du\s+(\d{2}\/\d{2}\/\d{4})\s+au\s+(\d{2}\/\d{2}\/\d{4})/i,
                /(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/,
                /Exercice\s+(\d{4})/i,
                /Année\s+(\d{4})/i
            ];
            
            for (const pattern of periodPatterns) {
                const match = text.match(pattern);
                if (match) {
                    if (match[2]) {
                        data.period = `${match[1]} au ${match[2]}`;
                    } else {
                        data.period = match[1];
                    }
                    console.log("Période trouvée:", data.period);
                    break;
                }
            }

            // Universal table extraction - improved regex patterns
            const tablePatterns = [
                // Harmonie Mutuelle format
                {
                    name: 'Harmonie Mutuelle',
                    pattern: /(\d{2}\/\d{2}\/\d{4})\s+([A-Za-zÀ-ÿ\s]+?)\s+([\d\s,]+)\s*€\s+([\d\s,]+)\s*€\s+([\d\s,]+)\s*€\s+([\d\s,]+)\s*€\s+([\d\s,]+)\s*€/g,
                    fields: ['date', 'libelle', 'montant_total', 'base_ss', 'remb_ss', 'remb_mutuelle', 'reste_charge']
                },
                // MGEN format
                {
                    name: 'MGEN',
                    pattern: /(\d+)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\s+([A-Za-z\s]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s*€\s+(\d+)\s*€\s+(\d+)\s*€\s+(\d+)\s*€/g,
                    fields: ['ref', 'nom', 'acte', 'date', 'depense_reelle', 'prise_charge', 'montant_regle', 'verse_assure']
                },
                // Generic format 1
                {
                    name: 'Generic 1',
                    pattern: /(\d{2}\/\d{2}\/\d{4})\s+([A-Za-zÀ-ÿ\s]+?)\s+([\d,]+)\s*€\s+([\d,]+)\s*€/g,
                    fields: ['date', 'libelle', 'secu', 'mutuelle']
                },
                // Generic format 2 (with more columns)
                {
                    name: 'Generic 2',
                    pattern: /(\d{2}\/\d{2}\/\d{4})\s+([A-Za-zÀ-ÿ\s]+?)\s+[A-Z\s]+\s+\d+\s+([\d,]+)\s*€\s+([\d,]+)\s*€/g,
                    fields: ['date', 'libelle', 'secu', 'mutuelle']
                },
                // Simple date-amount pattern
                {
                    name: 'Simple',
                    pattern: /(\d{2}\/\d{2}\/\d{4})[^\d]+([\d,]+)\s*€/g,
                    fields: ['date', 'montant']
                }
            ];

            let foundData = false;

            for (const tableFormat of tablePatterns) {
                console.log(`Tentative d'extraction avec le format: ${tableFormat.name}`);
                let match;
                let matchCount = 0;

                while ((match = tableFormat.pattern.exec(text)) !== null && matchCount < 1000) {
                    matchCount++;
                    foundData = true;
                    
                    console.log(`Match ${matchCount} trouvé:`, match);

                    let dateStr, libelle, secuAmount = 0, mutuelleAmount = 0, total = 0;

                    if (tableFormat.name === 'Minimal Format') {
                        // Pour ce format minimal sans dates, on utilise une date générique
                        dateStr = '01/07/2025'; // Date par défaut
                        libelle = 'Remboursement'; // Description générique
                        const depense = parseAmount(match[1]);
                        const rembTotal = parseAmount(match[2]);
                        const resteCharge = parseAmount(match[3]);
                        
                        // Tout le remboursement est attribué à la mutuelle car pas de séparation SS/Mutuelle
                        secuAmount = 0;
                        mutuelleAmount = rembTotal;
                        total = rembTotal;
                        
                        console.log(`Minimal: ${libelle} - Remb total: ${rembTotal}€`);
                        
                    } else if (tableFormat.name === 'Narrative Depense') {
                        dateStr = match[1];
                        libelle = match[2].trim();
                        const montantTotal = parseAmount(match[3]);
                        secuAmount = parseAmount(match[4]);
                        mutuelleAmount = parseAmount(match[5]);
                        total = secuAmount + mutuelleAmount;
                        
                        console.log(`Narrative: ${libelle} - SS: ${secuAmount}€ - Mutuelle: ${mutuelleAmount}€`);
                        
                    } else if (tableFormat.name === 'Multi-Beneficiary') {
                        dateStr = match[1];
                        libelle = match[2].trim();
                        const montant = parseAmount(match[3]);
                        const rembTotal = parseAmount(match[4]);
                        const resteCharge = parseAmount(match[5]);
                        
                        // Pour ce format, on met tout le remboursement en "mutuelle" 
                        // car on ne peut pas distinguer SS/Mutuelle
                        secuAmount = 0;
                        mutuelleAmount = rembTotal;
                        total = rembTotal;
                        
                        console.log(`Multi-Beneficiary: ${libelle} - Remb total: ${rembTotal}€`);
                        
                    } else if (tableFormat.name === 'Malakoff Humanis') {
                        const resteCharge = parseAmount(match[1]);
                        const montantTotal = parseAmount(match[2]);
                        mutuelleAmount = parseAmount(match[3]);
                        secuAmount = parseAmount(match[4]);
                        const baseSS = parseAmount(match[5]);
                        libelle = match[6].trim();
                        dateStr = match[7];
                        total = secuAmount + mutuelleAmount;
                        
                        console.log(`Malakoff: ${libelle} - SS: ${secuAmount}€ - Mutuelle: ${mutuelleAmount}€`);
                        
                    } else if (tableFormat.name === 'Allianz Narrative') {
                        libelle = match[1].trim();
                        dateStr = match[2];
                        const depense = parseAmount(match[3]);
                        secuAmount = parseAmount(match[4]);
                        mutuelleAmount = parseAmount(match[5]);
                        const resteCharge = parseAmount(match[6]);
                        total = secuAmount + mutuelleAmount;
                        
                        console.log(`Allianz: ${libelle} - SS: ${secuAmount}€ - Mutuelle: ${mutuelleAmount}€`);
                        
                    } else if (tableFormat.name === 'Harmonie Mutuelle') {
                        dateStr = match[1];
                        libelle = match[2].trim();
                        const montantTotal = parseAmount(match[3]);
                        const baseSS = parseAmount(match[4]);
                        secuAmount = parseAmount(match[5]);
                        mutuelleAmount = parseAmount(match[6]);
                        const resteCharge = parseAmount(match[7]);
                        total = secuAmount + mutuelleAmount;
                        
                    } else if (tableFormat.name === 'MGEN') {
                        const ref = match[1];
                        const nom = match[2];
                        libelle = match[3].trim();
                        dateStr = match[4];
                        const depenseReelle = parseAmount(match[5]);
                        const priseEnCharge = parseAmount(match[6]);
                        const montantRegle = parseAmount(match[7]);
                        mutuelleAmount = parseAmount(match[8]); // Versé à l'assuré
                        secuAmount = 0; // MGEN ne sépare pas toujours SS/Mutuelle clairement
                        total = mutuelleAmount;
                        
                    } else if (tableFormat.fields.includes('secu') && tableFormat.fields.includes('mutuelle')) {
                        dateStr = match[1];
                        libelle = match[2].trim();
                        secuAmount = parseAmount(match[3]);
                        mutuelleAmount = parseAmount(match[4]);
                        total = secuAmount + mutuelleAmount;
                        
                    } else if (tableFormat.name === 'Simple') {
                        dateStr = match[1];
                        libelle = 'Remboursement';
                        mutuelleAmount = parseAmount(match[2]);
                        total = mutuelleAmount;
                    }

                    const parsedDate = parseDate(dateStr);
                    if (!parsedDate) continue;

                    const year = parsedDate.split('/')[2];
                    const month = `${year}-${parsedDate.split('/')[1].padStart(2, '0')}`;

                    const reimbursement = {
                        date: parsedDate,
                        care: libelle,
                        secuAmount: secuAmount,
                        mutuelleAmount: mutuelleAmount,
                        total: total,
                        resteACharge: 0
                    };

                    data.reimbursements.push(reimbursement);
                    
                    data.totalSecu += secuAmount;
                    data.totalMutuelle += mutuelleAmount;
                    data.totalReimbursements += total;

                    // Agrégation par année
                    if (!data.totalByYear[year]) {
                        data.totalByYear[year] = { mutuelle: 0, secu: 0 };
                    }
                    data.totalByYear[year].mutuelle += mutuelleAmount;
                    data.totalByYear[year].secu += secuAmount;

                    // Agrégation par mois
                    if (!data.totalByMonth[month]) {
                        data.totalByMonth[month] = { mutuelle: 0, secu: 0 };
                    }
                    data.totalByMonth[month].mutuelle += mutuelleAmount;
                    data.totalByMonth[month].secu += secuAmount;
                }

                if (matchCount > 0) {
                    console.log(`Format ${tableFormat.name} utilisé avec succès: ${matchCount} entrées trouvées`);
                    break;
                }
            }

            // If no structured data found, try to extract any amounts and dates
            if (!foundData) {
                console.log("Aucun format structuré trouvé, extraction basique...");
                
                const basicPattern = /(\d{2}\/\d{2}\/\d{4})[^\d]*([\d,]+(?:\.\d{2})?\s*€)/g;
                let match;
                let fallbackCount = 0;
                
                while ((match = basicPattern.exec(text)) !== null && fallbackCount < 100) {
                    fallbackCount++;
                    const dateStr = match[1];
                    const amountStr = match[2];
                    const amount = parseAmount(amountStr);
                    
                    if (amount > 0) {
                        const parsedDate = parseDate(dateStr);
                        const year = parsedDate.split('/')[2];
                        const month = `${year}-${parsedDate.split('/')[1].padStart(2, '0')}`;
                        
                        data.reimbursements.push({
                            date: parsedDate,
                            care: 'Remboursement',
                            secuAmount: 0,
                            mutuelleAmount: amount,
                            total: amount,
                            resteACharge: 0
                        });
                        
                        data.totalMutuelle += amount;
                        data.totalReimbursements += amount;
                        
                        if (!data.totalByYear[year]) {
                            data.totalByYear[year] = { mutuelle: 0, secu: 0 };
                        }
                        data.totalByYear[year].mutuelle += amount;
                        
                        if (!data.totalByMonth[month]) {
                            data.totalByMonth[month] = { mutuelle: 0, secu: 0 };
                        }
                        data.totalByMonth[month].mutuelle += amount;
                    }
                }
                
                console.log(`Extraction basique: ${fallbackCount} entrées trouvées`);
            }

            console.log("Données finales extraites:", data);
            console.log("Total remboursements trouvés:", data.reimbursements.length + data.pharmacyPayments.length);
            
            return data;
        }

        function displayResults(data) {
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('instructionsNotice').style.display = 'none';
            document.getElementById('descriptionNotice').style.display = 'none';
            document.getElementById('confidentialityNotice').style.display = 'none';
            document.getElementById('resultsSection').style.display = 'block';

            // Update debug information
            updateDebugInfo();

            displayDetails(data);
            displayCotisations(data);
            displayAnalytics(data);
        }

        function updateDebugInfo() {
            document.getElementById('extractedText').textContent = extractedTextForDebug.substring(0, 5000) + (extractedTextForDebug.length > 5000 ? '...\n[Texte tronqué]' : '');
            document.getElementById('analyzedData').textContent = JSON.stringify(analysisData, null, 2);
        }

        function displayDetails(data) {
            const tbody = document.getElementById('detailsTable').querySelector('tbody');
            let allItems = [];

            data.reimbursements.forEach(item => {
                allItems.push({
                    date: item.date,
                    secuAmount: item.secuAmount,
                    mutuelleAmount: item.mutuelleAmount,
                    resteACharge: item.resteACharge,
                    total: item.total
                });
            });

            data.pharmacyPayments.forEach(item => {
                allItems.push({
                    date: item.date,
                    secuAmount: item.secuAmount,
                    mutuelleAmount: item.mutuelleAmount,
                    resteACharge: 0,
                    total: item.total
                });
            });

            sortItems(allItems, currentSortOrder);
            
            let rows = '';
            allItems.forEach(item => {
                rows += `
                    <tr>
                        <td>${item.date}</td>
                        <td class="amount-cell positive">${item.secuAmount.toFixed(2)}€</td>
                        <td class="amount-cell positive">${item.mutuelleAmount.toFixed(2)}€</td>
                        <td class="amount-cell positive"><strong>${item.total.toFixed(2)}€</strong></td>
                    </tr>
                `;
            });

            tbody.innerHTML = rows || '<tr><td colspan="4" style="text-align: center; color: #718096;">Aucun remboursement trouvé</td></tr>';
        }

        function sortTable(order) {
            if (order) {
                currentSortOrder = order;
            }
            displayDetails(analysisData);
        }

        function sortItems(items, order) {
            items.sort((a, b) => {
                const dateA = new Date(a.date.split('/').reverse().join('-'));
                const dateB = new Date(b.date.split('/').reverse().join('-'));
                
                if (order === 'asc') {
                    return dateA - dateB;
                } else {
                    return dateB - dateA;
                }
            });
        }

        function displayCotisations(data) {
            const cotisationsContent = document.getElementById('cotisationsContent');
            const years = Object.keys(data.totalByYear).sort((a, b) => b - a);
            
            if (years.length === 0) {
                cotisationsContent.innerHTML = `
                    <div class="cotisation-form">
                        <h3 style="color: #e53e3e;">Aucune donnée de remboursement trouvée</h3>
                        <p>Vérifiez que votre document PDF contient bien des informations de remboursement lisibles.</p>
                    </div>
                `;
                return;
            }
            
            if (!window.selectedYear) {
                window.selectedYear = years[0];
            }
            
            let yearOptions = '';
            years.forEach(year => {
                const isSelected = year === window.selectedYear ? 'selected' : '';
                yearOptions += `<option value="${year}" ${isSelected}>${year}</option>`;
            });

            cotisationsContent.innerHTML = `
                <div class="cotisation-form">
                    <h3 style="margin-bottom: 20px; color: #4a5568;">Gestion des Cotisations Mutuelles</h3>
                    <p style="margin-bottom: 20px; color: #718096;">
                        Renseignez vos cotisations mensuelles pour calculer le coût réel de votre mutuelle.
                    </p>
                    
                    <div class="year-selector" style="margin-bottom: 20px;">
                        <label style="font-weight: 500; color: #4a5568; margin-bottom: 10px; display: block;">
                            Sélectionnez une année :
                        </label>
                        <select id="yearSelector" onchange="selectYearFromDropdown()">
                            ${yearOptions}
                        </select>
                    </div>
                    
                    <div id="year-content">
                        <!-- Le contenu de l'année sélectionnée sera affiché ici -->
                    </div>
                    
                    <div class="privacy-notice" style="background: #f0f8ff; color: #1e3a8a; border-left-color: #3b82f6; margin-top: 20px;">
                        <strong>📊 Note sur le bilan :</strong> Un bilan positif indique un bénéfice (vous récupérez plus que ce que vous payez), un bilan négatif indique un déficit (vous payez plus que ce que vous récupérez).
                    </div>
                    
                    <div class="privacy-notice" style="background: #fef3c7; color: #92400e; border-left-color: #f59e0b; margin-top: 15px;">
                        <strong>⚠️ Avertissement :</strong> Les résultats sont indicatifs et fournis à titre informatif uniquement. Vérifiez toujours les calculs avec vos documents officiels. L'éditeur ne saurait être tenu responsable d'erreurs de calcul.
                    </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn" onclick="resetApp()">
                        🔄 Analyser un nouveau fichier
                    </button>
                </div>
            `;
            
            displayYearContent(window.selectedYear, data);
        }

        function selectYear(year) {
            window.selectedYear = year;
            displayYearContent(year, analysisData);
        }

        function selectYearFromDropdown() {
            const yearSelector = document.getElementById('yearSelector');
            const selectedYear = yearSelector.value;
            window.selectedYear = selectedYear;
            displayYearContent(selectedYear, analysisData);
        }

        function displayYearContent(year, data) {
            const yearContent = document.getElementById('year-content');
            
            yearContent.innerHTML = `
                <div class="year-section">
                    <div class="year-title">Année ${year}</div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="cotisation-${year}">Total cotisation mensuelle :</label>
                            <input type="number" id="cotisation-${year}" 
                                   placeholder="Ex: 85.50" step="0.01" 
                                   value="${cotisationsData[year] ? cotisationsData[year].cotisationMensuelle : ''}"
                                   onchange="calculateCotisations('${year}')">
                        </div>
                        <div class="form-group">
                            <label for="employeur-${year}">Contribution employeur mensuelle :</label>
                            <input type="number" id="employeur-${year}" 
                                   placeholder="Ex: 42.75" step="0.01" 
                                   value="${cotisationsData[year] ? cotisationsData[year].employeurMensuel : ''}"
                                   onchange="calculateCotisations('${year}')">
                        </div>
                    </div>
                    <div class="calculations" id="calc-${year}">
                        <div class="calc-row">
                            <span>Total cotisation annuelle :</span>
                            <span id="total-cotisation-${year}">${cotisationsData[year] ? cotisationsData[year].totalCotisationAnnuelle.toFixed(2) + '€' : '0.00€'}</span>
                        </div>
                        <div class="calc-row">
                            <span>Cotisation annuelle (vous) :</span>
                            <span id="votre-cotisation-${year}">${cotisationsData[year] ? cotisationsData[year].votreCotisationAnnuelle.toFixed(2) + '€' : '0.00€'}</span>
                        </div>
                        <div class="calc-row">
                            <span>Contribution employeur annuelle :</span>
                            <span id="contrib-employeur-${year}">${cotisationsData[year] ? cotisationsData[year].employeurAnnuel.toFixed(2) + '€' : '0.00€'}</span>
                        </div>
                        <div class="calc-row">
                            <span>Total remboursements reçus :</span>
                            <span id="rembours-recu-${year}">${data.totalByYear[year] ? data.totalByYear[year].mutuelle.toFixed(2) : '0.00'}€</span>
                        </div>
                        <div class="calc-row">
                            <span>Bilan :</span>
                            <span id="deficit-${year}" style="color: ${cotisationsData[year] && cotisationsData[year].deficit > 0 ? '#38a169' : '#e53e3e'}">
                                ${cotisationsData[year] ? cotisationsData[year].deficit.toFixed(2) + '€' : '0.00€'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }

        function calculateCotisations(year) {
            const cotisationInput = document.getElementById(`cotisation-${year}`);
            const employeurInput = document.getElementById(`employeur-${year}`);
            
            const totalCotisationMensuelle = parseFloat(cotisationInput.value) || 0;
            const employeurMensuel = parseFloat(employeurInput.value) || 0;
            
            const totalCotisationAnnuelle = totalCotisationMensuelle * 12;
            const employeurAnnuel = employeurMensuel * 12;
            const votreCotisationAnnuelle = totalCotisationAnnuelle - employeurAnnuel;
            
            const remboursementsRecus = analysisData.totalByYear[year] ? 
                analysisData.totalByYear[year].mutuelle : 0;
            const deficit = remboursementsRecus - votreCotisationAnnuelle;
            
            // Mise à jour de l'affichage
            document.getElementById(`total-cotisation-${year}`).textContent = totalCotisationAnnuelle.toFixed(2) + '€';
            document.getElementById(`votre-cotisation-${year}`).textContent = votreCotisationAnnuelle.toFixed(2) + '€';
            document.getElementById(`contrib-employeur-${year}`).textContent = employeurAnnuel.toFixed(2) + '€';
            document.getElementById(`rembours-recu-${year}`).textContent = remboursementsRecus.toFixed(2) + '€';
            
            const deficitElement = document.getElementById(`deficit-${year}`);
            deficitElement.textContent = deficit.toFixed(2) + '€';
            deficitElement.style.color = deficit > 0 ? '#38a169' : '#e53e3e';
            
            // Sauvegarde des données
            cotisationsData[year] = {
                cotisationMensuelle: totalCotisationMensuelle,
                employeurMensuel: employeurMensuel,
                votreCotisationAnnuelle: votreCotisationAnnuelle,
                employeurAnnuel: employeurAnnuel,
                totalCotisationAnnuelle: totalCotisationAnnuelle,
                remboursementsRecus: remboursementsRecus,
                deficit: deficit
            };
        }

        function displayAnalytics(data) {
            const analyticsContent = document.getElementById('analyticsContent');
            
            const totalItems = data.reimbursements.length + data.pharmacyPayments.length;
            const avgReimbursement = totalItems > 0 ? data.totalReimbursements / totalItems : 0;
            const avgMutuelleReimbursement = totalItems > 0 ? data.totalMutuelle / totalItems : 0;
            const avgSecuReimbursement = totalItems > 0 ? data.totalSecu / totalItems : 0;
            
            // Calcul du déficit total et moyen
            const years = Object.keys(data.totalByYear).sort();
            let totalDeficit = 0;
            let yearsWithData = 0;
            
            years.forEach(year => {
                if (cotisationsData[year] && cotisationsData[year].deficit) {
                    totalDeficit += cotisationsData[year].deficit;
                    yearsWithData++;
                }
            });
            
            const avgDeficit = yearsWithData > 0 ? totalDeficit / yearsWithData : 0;

            // Destruction des anciens graphiques
            Object.values(charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            charts = {};

            analyticsContent.innerHTML = `
                ${data.mutuelle ? `<div class="privacy-notice" style="background: #e8f5e8; color: #2d5016; border-left-color: #68d391; margin-bottom: 20px; text-align: center;">
                    <strong>🏥 Mutuelle analysée : ${data.mutuelle}</strong>
                </div>` : ''}
                <div class="summary-cards">
                    <div class="summary-card">
                        <h3>Total Remboursements Mutuelle</h3>
                        <div class="amount">${data.totalMutuelle.toFixed(2)}€</div>
                    </div>
                    <div class="summary-card">
                        <h3>Total Remboursements Sécurité Sociale</h3>
                        <div class="amount">${data.totalSecu.toFixed(2)}€</div>
                    </div>
                    <div class="summary-card">
                        <h3>Total Bilan Mutuelle</h3>
                        <div class="amount" style="color: ${totalDeficit > 0 ? '#38a169' : '#e53e3e'}">${totalDeficit.toFixed(2)}€</div>
                    </div>
                    <div class="summary-card">
                        <h3>Bilan Mutuelle Annuel Moyen</h3>
                        <div class="amount" style="color: ${avgDeficit > 0 ? '#38a169' : '#e53e3e'}">${avgDeficit.toFixed(2)}€</div>
                    </div>
                    <div class="summary-card">
                        <h3>Nombre de remboursements</h3>
                        <div class="amount">${totalItems}</div>
                    </div>
                    <div class="summary-card">
                        <h3>Remboursement Mutuelle moyen</h3>
                        <div class="amount">${avgMutuelleReimbursement.toFixed(2)}€</div>
                    </div>
                    <div class="summary-card">
                        <h3>Remboursement Sécurité Sociale moyen</h3>
                        <div class="amount">${avgSecuReimbursement.toFixed(2)}€</div>
                    </div>
                </div>
                
                <div class="chart-grid">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3 class="chart-title">📊 Analyse financière par année</h3>
                        </div>
                        <canvas id="yearlyChart"></canvas>
                    </div>
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3 class="chart-title">🥧 Répartition Mutuelle vs Sécurité Sociale</h3>
                        </div>
                        <canvas id="pieChart"></canvas>
                    </div>
                </div>
                
                <!-- Section Consentement pour les statistiques -->
                <div class="privacy-notice" style="background: #fff3cd; color: #856404; border-left-color: #ffc107; margin-bottom: 20px;">
                    <h3>📊 Contribution aux statistiques anonymes</h3>
                    <p>Pour améliorer notre service et fournir des analyses comparatives, nous collectons des données anonymisées :</p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Nom de votre mutuelle</li>
                        <li>Montants des cotisations et remboursements (sans dates ni détails personnels)</li>
                        <li>Bilans financiers calculés</li>
                    </ul>
                    <p><strong>Aucune donnée personnelle identifiante n'est collectée.</strong></p>
                    
                    <label style="display: flex; align-items: center; margin-top: 15px; font-weight: bold; cursor: pointer;">
                        <input type="checkbox" id="dataConsent" style="margin-right: 10px; transform: scale(1.2);">
                        J'accepte le partage anonyme de mes données pour contribuer aux statistiques
                    </label>
                    <p style="font-size: 0.9em; margin-top: 10px; opacity: 0.8;">
                        ✅ Requis pour télécharger le rapport complet
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-download" onclick="checkConsentAndDownload()" id="downloadReportBtn">
                        📊 Télécharger le rapport complet
                    </button>
                </div>
            `;

            // Créer les graphiques après l'insertion du HTML
            setTimeout(() => {
                createYearlyChart(data);
                createPieChart(data);
            }, 100);
        }

        function createYearlyChart(data) {
            const ctx = document.getElementById('yearlyChart');
            if (!ctx) return;

            const years = Object.keys(data.totalByYear).sort();
            const mutuelleData = years.map(year => data.totalByYear[year].mutuelle);
            const secuData = years.map(year => data.totalByYear[year].secu);
            
            const yourCotisationsData = years.map(year => {
                return cotisationsData[year] ? cotisationsData[year].votreCotisationAnnuelle : 0;
            });
            const deficitData = years.map(year => {
                return cotisationsData[year] ? cotisationsData[year].deficit : 0;
            });

            charts.yearly = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: years,
                    datasets: [{
                        label: 'Remboursement Mutuelle',
                        data: mutuelleData,
                        backgroundColor: 'rgba(102, 126, 234, 0.8)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 2,
                        borderRadius: 8,
                    }, {
                        label: 'Remboursement Sécurité Sociale',
                        data: secuData,
                        backgroundColor: 'rgba(56, 178, 172, 0.8)',
                        borderColor: 'rgba(56, 178, 172, 1)',
                        borderWidth: 2,
                        borderRadius: 8,
                    }, {
                        label: 'Cotisation annuelle (vous)',
                        data: yourCotisationsData,
                        backgroundColor: 'rgba(255, 159, 64, 0.8)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 2,
                        borderRadius: 8,
                    }, {
                        label: 'Bilan',
                        data: deficitData,
                        backgroundColor: 'rgba(255, 99, 132, 0.8)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        borderRadius: 8,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 20,
                            bottom: 50,
                            left: 20,
                            right: 20
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            align: 'center',
                            maxWidth: 800,
                            labels: {
                                usePointStyle: true,
                                padding: 15,
                                font: {
                                    size: 13,
                                    weight: '500'
                                },
                                boxWidth: 10,
                                generateLabels: function(chart) {
                                    const original = Chart.defaults.plugins.legend.labels.generateLabels;
                                    const labels = original.call(this, chart);
                                    return labels.map(label => {
                                        if (label.text === 'Cotisation annuelle (vous)') {
                                            label.text = 'Votre cotisation';
                                        }
                                        return label;
                                    });
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: 'rgba(102, 126, 234, 0.5)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '€';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 0,
                                minRotation: 0,
                                font: {
                                    size: 14,
                                    weight: '500'
                                },
                                padding: 10
                            }
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            },
                            ticks: {
                                font: {
                                    size: 12
                                },
                                callback: function(value) {
                                    return value.toFixed(0) + '€';
                                },
                                padding: 8
                            }
                        }
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }
            });
        }

        function createPieChart(data) {
            const ctx = document.getElementById('pieChart');
            if (!ctx) return;

            charts.pie = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Mutuelle', 'Sécurité Sociale'],
                    datasets: [{
                        data: [data.totalMutuelle, data.totalSecu],
                        backgroundColor: [
                            'rgba(102, 126, 234, 0.8)',
                            'rgba(56, 178, 172, 0.8)'
                        ],
                        borderColor: [
                            'rgba(102, 126, 234, 1)',
                            'rgba(56, 178, 172, 1)'
                        ],
                        borderWidth: 3,
                        hoverBackgroundColor: [
                            'rgba(102, 126, 234, 0.9)',
                            'rgba(56, 178, 172, 0.9)'
                        ],
                        cutout: '50%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 30,
                            bottom: 80,
                            left: 30,
                            right: 30
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: true,
                                padding: 25,
                                font: {
                                    size: 14,
                                    weight: '500'
                                },
                                boxWidth: 18,
                                generateLabels: function(chart) {
                                    const data = chart.data;
                                    const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, index) => {
                                        const value = data.datasets[0].data[index];
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                        return {
                                            text: `${label}: ${value.toFixed(2)}€ (${percentage}%)`,
                                            fillStyle: data.datasets[0].backgroundColor[index],
                                            hidden: false,
                                            index: index
                                        };
                                    });
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: 'rgba(102, 126, 234, 0.5)',
                            borderWidth: 1,
                            cornerRadius: 8,
                            callbacks: {
                                label: function(context) {
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : '0.0';
                                    return context.label + ': ' + context.parsed.toFixed(2) + '€ (' + percentage + '%)';
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 1500,
                        easing: 'easeOutQuart'
                    }
                }
            });
        }

        async function downloadAllChartsAsPDF() {
            try {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                let yPos = 20;

                // Page de titre
                pdf.setFontSize(20);
                pdf.text('Rapport de Calcul', pdfWidth / 2, yPos, { align: 'center' });
                yPos += 15;
                pdf.text('Remboursements de Mutuelle', pdfWidth / 2, yPos, { align: 'center' });
                yPos += 20;
                
                pdf.setFontSize(12);
                pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pdfWidth / 2, yPos, { align: 'center' });
                yPos += 10;
                
                if (analysisData.period) {
                    pdf.text(`Période: ${analysisData.period}`, pdfWidth / 2, yPos, { align: 'center' });
                    yPos += 10;
                }
                
                if (analysisData.mutuelle) {
                    pdf.text(`Mutuelle: ${analysisData.mutuelle}`, pdfWidth / 2, yPos, { align: 'center' });
                    yPos += 20;
                } else {
                    yPos += 20;
                }

                // Synthèse financière complète
                const totalItems = analysisData.reimbursements.length + analysisData.pharmacyPayments.length;
                const avgReimbursement = totalItems > 0 ? analysisData.totalReimbursements / totalItems : 0;
                const avgMutuelleReimbursement = totalItems > 0 ? analysisData.totalMutuelle / totalItems : 0;
                const avgSecuReimbursement = totalItems > 0 ? analysisData.totalSecu / totalItems : 0;
                
                const years = Object.keys(analysisData.totalByYear).sort();
                let totalDeficit = 0;
                let yearsWithData = 0;
                
                years.forEach(year => {
                    if (cotisationsData[year] && cotisationsData[year].deficit) {
                        totalDeficit += cotisationsData[year].deficit;
                        yearsWithData++;
                    }
                });
                
                const avgDeficit = yearsWithData > 0 ? totalDeficit / yearsWithData : 0;

                pdf.setFontSize(14);
                pdf.text('Synthèse Financière', 20, yPos);
                yPos += 15;
                
                pdf.setFontSize(11);
                pdf.text(`Total remboursements Mutuelle: ${analysisData.totalMutuelle.toFixed(2)}€`, 20, yPos);
                yPos += 8;
                pdf.text(`Total remboursements Sécurité Sociale: ${analysisData.totalSecu.toFixed(2)}€`, 20, yPos);
                yPos += 8;
                pdf.text(`Total bilan Mutuelle: ${totalDeficit.toFixed(2)}€`, 20, yPos);
                yPos += 8;
                pdf.text(`Bilan Mutuelle annuel moyen: ${avgDeficit.toFixed(2)}€`, 20, yPos);
                yPos += 8;
                pdf.text(`Nombre de remboursements: ${totalItems}`, 20, yPos);
                yPos += 8;
                pdf.text(`Remboursement Mutuelle moyen: ${avgMutuelleReimbursement.toFixed(2)}€`, 20, yPos);
                yPos += 8;
                pdf.text(`Remboursement Sécurité Sociale moyen: ${avgSecuReimbursement.toFixed(2)}€`, 20, yPos);
                yPos += 20;

                // Tableau des cotisations
                if (Object.keys(cotisationsData).length > 0) {
                    pdf.setFontSize(14);
                    pdf.text('Détail des Cotisations par Année', 20, yPos);
                    yPos += 15;

                    // En-têtes du tableau
                    pdf.setFontSize(9);
                    const colWidths = [20, 30, 35, 30, 35, 35];
                    const colPositions = [20, 40, 70, 105, 135, 170];
                    const headers = ['Année', 'Cotisation/mois', 'Employeur/mois', 'Votre part/an', 'Remboursements/an', 'Bilan/an'];
                    
                    // Dessiner les en-têtes
                    pdf.setFillColor(102, 126, 234);
                    pdf.rect(20, yPos - 5, 170, 8, 'F');
                    pdf.setTextColor(255, 255, 255);
                    headers.forEach((header, i) => {
                        pdf.text(header, colPositions[i] + 2, yPos, { maxWidth: colWidths[i] - 4 });
                    });
                    yPos += 10;
                    
                    pdf.setTextColor(0, 0, 0);
                    
                    // Données du tableau
                    Object.keys(cotisationsData).sort().forEach((year, index) => {
                        const data = cotisationsData[year];
                        const rowData = [
                            year,
                            `${data.cotisationMensuelle.toFixed(2)}€`,
                            `${data.employeurMensuel.toFixed(2)}€`,
                            `${data.votreCotisationAnnuelle.toFixed(2)}€`,
                            `${data.remboursementsRecus.toFixed(2)}€`,
                            `${data.deficit.toFixed(2)}€`
                        ];
                        
                        // Alterner les couleurs de fond
                        if (index % 2 === 0) {
                            pdf.setFillColor(245, 245, 245);
                            pdf.rect(20, yPos - 5, 170, 8, 'F');
                        }
                        
                        rowData.forEach((cell, i) => {
                            pdf.text(cell, colPositions[i] + 2, yPos, { maxWidth: colWidths[i] - 4 });
                        });
                        yPos += 8;
                    });
                    yPos += 10;
                }

                // Ajouter les graphiques avec taille réduite
                const chartIds = ['yearlyChart', 'pieChart'];
                const chartTitles = ['Analyse financière par année', 'Répartition Mutuelle vs Sécurité Sociale'];

                for (let i = 0; i < chartIds.length; i++) {
                    const canvas = document.getElementById(chartIds[i]);
                    if (canvas) {
                        // Nouvelle page pour chaque graphique
                        pdf.addPage();

                        // Titre du graphique
                        pdf.setFontSize(16);
                        pdf.text(chartTitles[i], pdfWidth / 2, 20, { align: 'center' });

                        // Créer un canvas haute résolution pour le graphique
                        const tempCanvas = document.createElement('canvas');
                        const tempCtx = tempCanvas.getContext('2d');
                        const scaleFactor = 3;
                        
                        tempCanvas.width = canvas.width * scaleFactor;
                        tempCanvas.height = canvas.height * scaleFactor;
                        tempCtx.scale(scaleFactor, scaleFactor);
                        
                        tempCtx.imageSmoothingEnabled = true;
                        tempCtx.imageSmoothingQuality = 'high';
                        
                        // Ajouter un fond blanc
                        tempCtx.fillStyle = '#ffffff';
                        tempCtx.fillRect(0, 0, canvas.width, canvas.height);
                        
                        tempCtx.drawImage(canvas, 0, 0);
                        
                        const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
                        
                        // Dimensions plus petites pour les graphiques
                        const maxWidth = Math.min(pdfWidth - 60, 130);
                        const maxHeight = pdfHeight - 100;
                        
                        let imgWidth = maxWidth;
                        let imgHeight = (canvas.height * imgWidth) / canvas.width;
                        
                        // Si trop haut, ajuster selon la hauteur
                        if (imgHeight > maxHeight) {
                            imgHeight = maxHeight;
                            imgWidth = (canvas.width * imgHeight) / canvas.height;
                        }
                        
                        const x = (pdfWidth - imgWidth) / 2;
                        const y = 50;

                        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
                    }
                }

                // Télécharger le PDF complet
                pdf.save('rapport-calcul-mutuelle.pdf');
                showDownloadSuccess();

            } catch (error) {
                showError('Erreur lors de la génération du PDF: ' + error.message);
            }
        }

        function showDownloadSuccess() {
            const statusDiv = document.getElementById('downloadStatus');
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }

        function switchTab(tabName) {
            // Masquer tous les onglets
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Afficher l'onglet sélectionné
            document.getElementById(tabName + 'Tab').classList.add('active');
            event.target.classList.add('active');

            // Si on bascule vers l'onglet analytics, recréer les graphiques
            if (tabName === 'analytics' && analysisData) {
                setTimeout(() => {
                    displayAnalytics(analysisData);
                }, 100);
            }

            // Si on bascule vers l'onglet debug, mettre à jour les infos
            if (tabName === 'debug' && analysisData) {
                updateDebugInfo();
            }
        }

        function showLoading() {
            document.getElementById('uploadSection').style.display = 'none';
            document.getElementById('loadingSection').style.display = 'block';
        }

        function hideLoading() {
            document.getElementById('loadingSection').style.display = 'none';
        }

        function showError(message) {
            const uploadSection = document.getElementById('uploadSection');
            uploadSection.style.display = 'block';
            
            let errorDiv = document.getElementById('errorMessage');
            if (errorDiv) {
                errorDiv.remove();
            }
            
            errorDiv = document.createElement('div');
            errorDiv.id = 'errorMessage';
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = message;
            
            uploadSection.appendChild(errorDiv);
        }

        function resetApp() {
            document.getElementById('resultsSection').style.display = 'none';
            document.getElementById('uploadSection').style.display = 'block';
            document.getElementById('instructionsNotice').style.display = 'block';
            document.getElementById('descriptionNotice').style.display = 'block';
            document.getElementById('confidentialityNotice').style.display = 'block';
            document.getElementById('fileInput').value = '';
            
            // Réinitialiser le consentement
            const consentCheckbox = document.getElementById('dataConsent');
            if (consentCheckbox) {
                consentCheckbox.checked = false;
            }
            
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.remove();
            }
            
            // Détruire les graphiques existants
            Object.values(charts).forEach(chart => {
                if (chart) chart.destroy();
            });
            charts = {};
            
            analysisData = null;
            cotisationsData = {};
            currentSortOrder = 'desc';
            window.selectedYear = null;
        }