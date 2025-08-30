        let yearOptions = '';
        years.forEach(year => {
            const isSelected = year === AppState.selectedYear ? 'selected' : '';
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
                    <select id="yearSelector" onchange="CotisationsManager.selectYearFromDropdown()">
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
        `;
        
        CotisationsManager.displayYearContent(AppState.selectedYear, data);
    },

    selectYearFromDropdown() {
        const yearSelector = document.getElementById('yearSelector');
        const selectedYear = yearSelector.value;
        AppState.selectedYear = selectedYear;
        CotisationsManager.displayYearContent(selectedYear, AppState.analysisData);
    },

    displayYearContent(year, data) {
        const yearContent = document.getElementById('year-content');
        
        yearContent.innerHTML = `
            <div class="year-section">
                <div class="year-title">Année ${year}</div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="cotisation-${year}">Total cotisation mensuelle :</label>
                        <input type="number" id="cotisation-${year}" 
                               placeholder="Ex: 85.50" step="0.01" 
                               value="${AppState.cotisationsData[year] ? AppState.cotisationsData[year].cotisationMensuelle : ''}"
                               onchange="CotisationsManager.calculateCotisations('${year}')">
                    </div>
                    <div class="form-group">
                        <label for="employeur-${year}">Contribution employeur mensuelle :</label>
                        <input type="number" id="employeur-${year}" 
                               placeholder="Ex: 42.75" step="0.01" 
                               value="${AppState.cotisationsData[year] ? AppState.cotisationsData[year].employeurMensuel : ''}"
                               onchange="CotisationsManager.calculateCotisations('${year}')">
                    </div>
                </div>
                <div class="calculations" id="calc-${year}">
                    <div class="calc-row">
                        <span>Total cotisation annuelle :</span>
                        <span id="total-cotisation-${year}">${AppState.cotisationsData[year] ? Utils.formatCurrency(AppState.cotisationsData[year].totalCotisationAnnuelle) : Utils.formatCurrency(0)}</span>
                    </div>
                    <div class="calc-row">
                        <span>Cotisation annuelle (vous) :</span>
                        <span id="votre-cotisation-${year}">${AppState.cotisationsData[year] ? Utils.formatCurrency(AppState.cotisationsData[year].votreCotisationAnnuelle) : Utils.formatCurrency(0)}</span>
                    </div>
                    <div class="calc-row">
                        <span>Contribution employeur annuelle :</span>
                        <span id="contrib-employeur-${year}">${AppState.cotisationsData[year] ? Utils.formatCurrency(AppState.cotisationsData[year].employeurAnnuel) : Utils.formatCurrency(0)}</span>
                    </div>
                    <div class="calc-row">
                        <span>Total remboursements reçus :</span>
                        <span id="rembours-recu-${year}">${data.totalByYear[year] ? Utils.formatCurrency(data.totalByYear[year].mutuelle) : Utils.formatCurrency(0)}</span>
                    </div>
                    <div class="calc-row">
                        <span>Bilan :</span>
                        <span id="deficit-${year}" style="color: ${AppState.cotisationsData[year] && AppState.cotisationsData[year].deficit > 0 ? '#38a169' : '#e53e3e'}">
                            ${AppState.cotisationsData[year] ? Utils.formatCurrency(AppState.cotisationsData[year].deficit) : Utils.formatCurrency(0)}
                        </span>
                    </div>
                </div>
            </div>
        `;
    },

    calculateCotisations(year) {
        const cotisationInput = document.getElementById(`cotisation-${year}`);
        const employeurInput = document.getElementById(`employeur-${year}`);
        
        const totalCotisationMensuelle = parseFloat(cotisationInput.value) || 0;
        const employeurMensuel = parseFloat(employeurInput.value) || 0;
        
        const totalCotisationAnnuelle = totalCotisationMensuelle * 12;
        const employeurAnnuel = employeurMensuel * 12;
        const votreCotisationAnnuelle = totalCotisationAnnuelle - employeurAnnuel;
        
        const remboursementsRecus = AppState.analysisData.totalByYear[year] ? 
            AppState.analysisData.totalByYear[year].mutuelle : 0;
        const deficit = remboursementsRecus - votreCotisationAnnuelle; // Inversé: remboursements - cotisations
        
        // Mise à jour de l'affichage
        document.getElementById(`total-cotisation-${year}`).textContent = Utils.formatCurrency(totalCotisationAnnuelle);
        document.getElementById(`votre-cotisation-${year}`).textContent = Utils.formatCurrency(votreCotisationAnnuelle);
        document.getElementById(`contrib-employeur-${year}`).textContent = Utils.formatCurrency(employeurAnnuel);
        document.getElementById(`rembours-recu-${year}`).textContent = Utils.formatCurrency(remboursementsRecus);
        
        const deficitElement = document.getElementById(`deficit-${year}`);
        deficitElement.textContent = Utils.formatCurrency(deficit);
        deficitElement.style.color = deficit > 0 ? '#38a169' : '#e53e3e'; // Inversé: positif = vert, négatif = rouge
        
        // Sauvegarde des données
        AppState.cotisationsData[year] = {
            cotisationMensuelle: totalCotisationMensuelle,
            employeurMensuel: employeurMensuel,
            votreCotisationAnnuelle: votreCotisationAnnuelle,
            employeurAnnuel: employeurAnnuel,
            totalCotisationAnnuelle: totalCotisationAnnuelle,
            remboursementsRecus: remboursementsRecus,
            deficit: deficit
        };
    }
};

// Gestionnaire des analytics et graphiques
const AnalyticsManager = {
    display(data) {
        const analyticsContent = document.getElementById('analyticsContent');
        
        const totalItems = data.reimbursements.length + data.pharmacyPayments.length;
        const avgMutuelleReimbursement = totalItems > 0 ? data.totalMutuelle / totalItems : 0;
        const avgSecuReimbursement = totalItems > 0 ? data.totalSecu / totalItems : 0;
        
        // Calcul du déficit total et moyen
        const years = Object.keys(data.totalByYear).sort();
        let totalDeficit = 0;
        let yearsWithData = 0;
        
        years.forEach(year => {
            if (AppState.cotisationsData[year] && AppState.cotisationsData[year].deficit) {
                totalDeficit += AppState.cotisationsData[year].deficit;
                yearsWithData++;
            }
        });
        
        const avgDeficit = yearsWithData > 0 ? totalDeficit / yearsWithData : 0;

        // Destruction des anciens graphiques
        Object.values(AppState.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        AppState.charts = {};

        analyticsContent.innerHTML = `
            <div class="summary-cards">
                <div class="summary-card">
                    <h3>Total Remboursements Mutuelle</h3>
                    <div class="amount">${Utils.formatCurrency(data.totalMutuelle)}</div>
                </div>
                <div class="summary-card">
                    <h3>Total Remboursements Sécurité Sociale</h3>
                    <div class="amount">${Utils.formatCurrency(data.totalSecu)}</div>
                </div>
                <div class="summary-card">
                    <h3>Total Bilan Mutuelle</h3>
                    <div class="amount" style="color: ${totalDeficit > 0 ? '#38a169' : '#e53e3e'}">${Utils.formatCurrency(totalDeficit)}</div>
                </div>
                <div class="summary-card">
                    <h3>Bilan Mutuelle Annuel Moyen</h3>
                    <div class="amount" style="color: ${avgDeficit > 0 ? '#38a169' : '#e53e3e'}">${Utils.formatCurrency(avgDeficit)}</div>
                </div>
                <div class="summary-card">
                    <h3>Nombre de remboursements</h3>
                    <div class="amount">${totalItems}</div>
                </div>
                <div class="summary-card">
                    <h3>Remboursement Mutuelle moyen</h3>
                    <div class="amount">${Utils.formatCurrency(avgMutuelleReimbursement)}</div>
                </div>
                <div class="summary-card">
                    <h3>Remboursement Sécurité Sociale moyen</h3>
                    <div class="amount">${Utils.formatCurrency(avgSecuReimbursement)}</div>
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
            
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-download" onclick="PDFGenerator.downloadAllChartsAsPDF()">
                    📊 Télécharger le rapport complet
                </button>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn" onclick="App.reset()">Analyser un nouveau fichier</button>
            </div>
        `;

        // Créer les graphiques après l'insertion du HTML
        setTimeout(() => {
            ChartManager.createYearlyChart(data);
            ChartManager.createPieChart(data);
        }, 100);
    }
};

// Gestionnaire des graphiques
const ChartManager = {
    createYearlyChart(data) {
        const ctx = document.getElementById('yearlyChart');
        if (!ctx) return;

        const years = Object.keys(data.totalByYear).sort();
        const mutuelleData = years.map(year => data.totalByYear[year].mutuelle);
        const secuData = years.map(year => data.totalByYear[year].secu);
        
        const yourCotisationsData = years.map(year => {
            return AppState.cotisationsData[year] ? AppState.cotisationsData[year].votreCotisationAnnuelle : 0;
        });
        const deficitData = years.map(year => {
            return AppState.cotisationsData[year] ? AppState.cotisationsData[year].deficit : 0;
        });

        AppState.charts.yearly = new Chart(ctx, {
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
                    label: 'Votre cotisation',
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
                                    // Raccourcir les textes pour qu'ils tiennent sur une ligne
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
                                return context.dataset.label + ': ' + Utils.formatCurrency(context.parsed.y);
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
                                return Utils.formatCurrency(value);
                            },
                            padding: 8
                        }
                    }
                },
                animation: {
                    duration: CONFIG.CHART_ANIMATION_DURATION,
                    easing: 'easeOutQuart'
                }
            }
        });
    },

    createPieChart(data) {
        const ctx = document.getElementById('pieChart');
        if (!ctx) return;

        AppState.charts.pie = new Chart(ctx, {
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
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return {
                                        text: `${label}: ${Utils.formatCurrency(value)} (${percentage}%)`,
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
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return context.label + ': ' + Utils.formatCurrency(context.parsed) + ' (' + percentage + '%)';
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
};

// Gestionnaire de génération PDF
const PDFGenerator = {
    async downloadAllChartsAsPDF() {
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
            pdf.text('Rapport d\'Analyse', pdfWidth / 2, yPos, { align: 'center' });
            yPos += 15;
            pdf.text('Remboursements de Mutuelle', pdfWidth / 2, yPos, { align: 'center' });
            yPos += 20;
            
            pdf.setFontSize(12);
            pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pdfWidth / 2, yPos, { align: 'center' });
            yPos += 10;
            
            if (AppState.analysisData.period) {
                pdf.text(`Période: ${AppState.analysisData.period}`, pdfWidth / 2, yPos, { align: 'center' });
                yPos += 20;
            }

            // Synthèse financière complète
            PDFGenerator.addFinancialSummary(pdf, yPos);
            
            // Tableau des cotisations
            if (Object.keys(AppState.cotisationsData).length > 0) {
                PDFGenerator.addCotisationsTable(pdf);
            }

            // Ajouter les graphiques
            await PDFGenerator.addChartsToPDF(pdf);

            // Télécharger le PDF complet
            pdf.save('rapport-analyse-mutuelle.pdf');
            PDFGenerator.showDownloadSuccess();

        } catch (error) {
            console.error('Erreur PDF:', error);
            ErrorHandler.show('Erreur lors de la génération du PDF: ' + error.message);
        }
    },

    addFinancialSummary(pdf, startY) {
        const totalItems = AppState.analysisData.reimbursements.length + AppState.analysisData.pharmacyPayments.length;
        const avgMutuelleReimbursement = totalItems > 0 ? AppState.analysisData.totalMutuelle / totalItems : 0;
        const avgSecuReimbursement = totalItems > 0 ? AppState.analysisData.totalSecu / totalItems : 0;
        
        const years = Object.keys(AppState.analysisData.totalByYear).sort();
        let totalDeficit = 0;
        let yearsWithData = 0;
        
        years.forEach(year => {
            if (AppState.cotisationsData[year] && AppState.cotisationsData[year].deficit) {
                totalDeficit += AppState.cotisationsData[year].deficit;
                yearsWithData++;
            }
        });
        
        const avgDeficit = yearsWithData > 0 ? totalDeficit / yearsWithData : 0;

        let yPos = startY;
        pdf.setFontSize(14);
        pdf.text('Synthèse Financière', 20, yPos);
        yPos += 15;
        
        pdf.setFontSize(11);
        pdf.text(`Total remboursements Mutuelle: ${Utils.formatCurrency(AppState.analysisData.totalMutuelle)}`, 20, yPos);
        yPos += 8;
        pdf.text(`Total remboursements Sécurité Sociale: ${Utils.formatCurrency(AppState.analysisData.totalSecu)}`, 20, yPos);
        yPos += 8;
        pdf.text(`Total bilan Mutuelle: ${Utils.formatCurrency(totalDeficit)}`, 20, yPos);
        yPos += 8;
        pdf.text(`Bilan Mutuelle annuel moyen: ${Utils.formatCurrency(avgDeficit)}`, 20, yPos);
        yPos += 8;
        pdf.text(`Nombre de remboursements: ${totalItems}`, 20, yPos);
        yPos += 8;
        pdf.text(`Remboursement Mutuelle moyen: ${Utils.formatCurrency(avgMutuelleReimbursement)}`, 20, yPos);
        yPos += 8;
        pdf.text(`Remboursement Sécurité Sociale moyen: ${Utils.formatCurrency(avgSecuReimbursement)}`, 20, yPos);
        yPos += 20;

        return yPos;
    },

    addCotisationsTable(pdf) {
        let yPos = 120;
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
        Object.keys(AppState.cotisationsData).sort().forEach((year, index) => {
            const data = AppState.cotisationsData[year];
            const rowData = [
                year,
                Utils.formatCurrency(data.cotisationMensuelle),
                Utils.formatCurrency(data.employeurMensuel),
                Utils.formatCurrency(data.votreCotisationAnnuelle),
                Utils.formatCurrency(data.remboursementsRecus),
                Utils.formatCurrency(data.deficit)
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
    },

    async addChartsToPDF(pdf) {
        const chartIds = ['yearlyChart', 'pieChart'];
        const chartTitles = ['Analyse financière par année', 'Répartition Mutuelle vs Sécurité Sociale'];

        for (let i = 0; i < chartIds.length; i++) {
            const canvas = document.getElementById(chartIds[i]);
            if (canvas) {
                // Nouvelle page pour chaque graphique
                pdf.addPage();

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                // Titre du graphique
                pdf.setFontSize(16);
                pdf.text(chartTitles[i], pdfWidth / 2, 20, { align: 'center' });

                // Créer un canvas haute résolution pour le graphique
                const imgData = await PDFGenerator.createHighResolutionChart(canvas);
                
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

                pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
            }
        }
    },

    async createHighResolutionChart(canvas) {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        const scaleFactor = CONFIG.PDF_SCALE_FACTOR;
        
        tempCanvas.width = canvas.width * scaleFactor;
        tempCanvas.height = canvas.height * scaleFactor;
        tempCtx.scale(scaleFactor, scaleFactor);
        
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        
        // Ajouter un fond blanc
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, canvas.width, canvas.height);
        
        tempCtx.drawImage(canvas, 0, 0);
        
        return tempCanvas.toDataURL('image/jpeg', CONFIG.PDF_QUALITY);
    },

    showDownloadSuccess() {
        const statusDiv = document.getElementById('downloadStatus');
        if (statusDiv) {
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
};

// Gestionnaire des onglets
const TabManager = {
    switch(tabName) {
        // Masquer tous les onglets
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Afficher l'onglet sélectionné
        const targetTab = document.getElementById(tabName + 'Tab');
        const activeTab = event ? event.target : document.querySelector(`[onclick="TabManager.switch('${tabName}')"]`);
        
        if (targetTab) targetTab.classList.add('active');
        if (activeTab) activeTab.classList.add('active');

        // Si on bascule vers l'onglet analytics, recréer les graphiques
        if (tabName === 'analytics' && AppState.analysisData) {
            setTimeout(() => {
                AnalyticsManager.display(AppState.analysisData);
            }, 100);
        }
    }
};

// Gestionnaire de tri des tableaux
const TableSorter = {
    sort(order) {
        if (order) {
            AppState.currentSortOrder = order;
        }
        TableManager.displayDetails(AppState.analysisData);
    }
};

// Classe principale de l'application
const App = {
    init() {
        // Configuration PDF.js
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.PDF_WORKER_SRC;
        }
        
        Utils.suppressWarnings();
        DragDropHandler.init();
        
        console.log('Mutuelle Calculateur initialisé');
    },

    reset() {
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('instructionsNotice').style.display = 'block';
        document.getElementById('descriptionNotice').style.display = 'block';
        document.getElementById('confidentialityNotice').style.display = 'block';
        document.getElementById('fileInput').value = '';
        
        ErrorHandler.clear();
        
        // Détruire les graphiques existants
        Object.values(AppState.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        AppState.charts = {};
        
        // Réinitialiser l'état
        AppState.analysisData = null;
        AppState.cotisationsData = {};
        AppState.currentSortOrder = 'desc';
        AppState.selectedYear = null;
    }
};

// Fonctions globales pour compatibilité avec l'HTML
window.handleDragOver = DragDropHandler.handleDragOver;
window.handleDragLeave = DragDropHandler.handleDragLeave;
window.handleDrop = DragDropHandler.handleDrop;
window.handleFileSelect = DragDropHandler.handleFileSelect;
window.switchTab = TabManager.switch;
window.sortTable = TableSorter.sort;
window.CotisationsManager = CotisationsManager;
window.PDFGenerator = PDFGenerator;
window.App = App;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', App.init);

// Export pour utilisation en module (optionnel)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        App,
        Utils,
        DataAnalyzer,
        ChartManager,
        PDFGenerator
    };
}/**
 * Mutuelle Calculateur - Application JavaScript
 * Calcul de la rentabilité des remboursements mutuelles
 */

// Configuration globale
const CONFIG = {
    PDF_WORKER_SRC: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js',
    CHART_ANIMATION_DURATION: 1000,
    PDF_SCALE_FACTOR: 3,
    PDF_QUALITY: 0.95
};

// État global de l'application
const AppState = {
    analysisData: null,
    cotisationsData: {},
    currentSortOrder: 'desc',
    charts: {},
    selectedYear: null
};

// Utilitaires
const Utils = {
    // Formatage des nombres
    formatCurrency: (amount) => `${amount.toFixed(2)}€`,
    
    // Conversion de date
    parseDate: (dateStr) => new Date(dateStr.split('/').reverse().join('-')),
    
    // Validation PDF
    validatePDFFile: (file) => {
        if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };
        if (file.type !== 'application/pdf') return { valid: false, error: 'Le fichier doit être un PDF' };
        if (file.size > 50 * 1024 * 1024) return { valid: false, error: 'Le fichier est trop volumineux (max 50MB)' };
        return { valid: true };
    },

    // Suppression des warnings console
    suppressWarnings: () => {
        const originalWarn = console.warn;
        console.warn = function(message) {
            if (message && message.toString().includes('Setting up fake worker')) {
                return;
            }
            originalWarn.apply(console, arguments);
        };
    }
};

// Gestionnaire d'erreurs
const ErrorHandler = {
    show: (message) => {
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
    },

    clear: () => {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.remove();
        }
    }
};

// Gestionnaire de chargement
const LoadingManager = {
    show: () => {
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('loadingSection').style.display = 'block';
    },

    hide: () => {
        document.getElementById('loadingSection').style.display = 'none';
    }
};

// Gestionnaire de glisser-déposer
const DragDropHandler = {
    init: () => {
        const uploadZone = document.querySelector('.upload-zone');
        
        uploadZone.addEventListener('dragover', DragDropHandler.handleDragOver);
        uploadZone.addEventListener('dragleave', DragDropHandler.handleDragLeave);
        uploadZone.addEventListener('drop', DragDropHandler.handleDrop);
        uploadZone.addEventListener('click', () => document.getElementById('fileInput').click());
        
        document.getElementById('fileInput').addEventListener('change', DragDropHandler.handleFileSelect);
    },

    handleDragOver: (e) => {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    },

    handleDragLeave: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    },

    handleDrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            FileProcessor.process(files[0]);
        }
    },

    handleFileSelect: (e) => {
        const file = e.target.files[0];
        if (file) {
            FileProcessor.process(file);
        }
    }
};

// Processeur de fichiers PDF
const FileProcessor = {
    async process(file) {
        const validation = Utils.validatePDFFile(file);
        if (!validation.valid) {
            ErrorHandler.show(validation.error);
            return;
        }

        LoadingManager.show();
        ErrorHandler.clear();

        try {
            const text = await FileProcessor.extractTextFromPDF(file);
            AppState.analysisData = await DataAnalyzer.analyzeDocument(text);
            ResultsManager.display(AppState.analysisData);
        } catch (error) {
            console.error('Erreur de traitement:', error);
            ErrorHandler.show(`Erreur lors du traitement du fichier: ${error.message}`);
        } finally {
            LoadingManager.hide();
        }
    },

    async extractTextFromPDF(file) {
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
};

// Analyseur de données
const DataAnalyzer = {
    async analyzeDocument(text) {
        const data = {
            beneficiary: '',
            period: '',
            totalReimbursements: 0,
            totalMutuelle: 0,
            totalSecu: 0,
            reimbursements: [],
            pharmacyPayments: [],
            totalByYear: {},
            totalByMonth: {}
        };

        // Extraction du bénéficiaire
        const nameMatch = text.match(/([A-Z]+\s+[A-Z]+)\s+\d+\s+RUE/);
        if (nameMatch) {
            data.beneficiary = nameMatch[1];
        }

        // Extraction de la période
        const periodMatch = text.match(/Période du (\d{2}\/\d{2}\/\d{4}) au (\d{2}\/\d{2}\/\d{4})/);
        if (periodMatch) {
            data.period = `${periodMatch[1]} au ${periodMatch[2]}`;
        }

        // Extraction des remboursements
        DataAnalyzer.extractReimbursements(text, data);
        DataAnalyzer.extractPharmacyPayments(text, data);

        return data;
    },

    extractReimbursements(text, data) {
        const reimbursementPattern = /([^\n]+?)\s+(\d{2}\/\d{2}\/\d{4})\s+[A-Z\s]+\s+\d+\s+([\d,]+)\s€\s+([\d,]+)\s€/g;
        let match;

        while ((match = reimbursementPattern.exec(text)) !== null) {
            const care = match[1].trim();
            const date = match[2];
            const secuAmount = parseFloat(match[3].replace(',', '.'));
            const mutuelleAmount = parseFloat(match[4].replace(',', '.'));
            const year = date.split('/')[2];
            const month = `${year}-${date.split('/')[1].padStart(2, '0')}`;

            data.reimbursements.push({
                date: date,
                care: care,
                secuAmount: secuAmount,
                mutuelleAmount: mutuelleAmount,
                total: secuAmount + mutuelleAmount,
                resteACharge: 0
            });

            DataAnalyzer.updateTotals(data, secuAmount, mutuelleAmount, year, month);
        }
    },

    extractPharmacyPayments(text, data) {
        const pharmacyPattern = /([^\n]+?)\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+[A-Z\s]+\s+[A-Z\s]+\s+([\d,]+)\s€\s+([\d,]+)\s€/g;
        let match;

        while ((match = pharmacyPattern.exec(text)) !== null) {
            const item = match[1].trim();
            const date = match[2];
            const secuAmount = parseFloat(match[3].replace(',', '.'));
            const mutuelleAmount = parseFloat(match[4].replace(',', '.'));

            if (mutuelleAmount > 0) {
                const year = date.split('/')[2];
                const month = `${year}-${date.split('/')[1].padStart(2, '0')}`;

                data.pharmacyPayments.push({
                    date: date,
                    item: item,
                    secuAmount: secuAmount,
                    mutuelleAmount: mutuelleAmount,
                    total: secuAmount + mutuelleAmount
                });

                DataAnalyzer.updateTotals(data, secuAmount, mutuelleAmount, year, month);
            }
        }
    },

    updateTotals(data, secuAmount, mutuelleAmount, year, month) {
        data.totalSecu += secuAmount;
        data.totalMutuelle += mutuelleAmount;
        data.totalReimbursements += secuAmount + mutuelleAmount;

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
};

// Gestionnaire des résultats
const ResultsManager = {
    display(data) {
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('instructionsNotice').style.display = 'none';
        document.getElementById('descriptionNotice').style.display = 'none';
        document.getElementById('confidentialityNotice').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';

        TableManager.displayDetails(data);
        CotisationsManager.display(data);
        AnalyticsManager.display(data);
    }
};

// Gestionnaire des tableaux
const TableManager = {
    displayDetails(data) {
        const tbody = document.getElementById('detailsTable').querySelector('tbody');
        let allItems = [];

        // Combinaison des remboursements et paiements pharmacie
        data.reimbursements.forEach(item => {
            allItems.push({
                date: item.date,
                secuAmount: item.secuAmount,
                mutuelleAmount: item.mutuelleAmount,
                total: item.total
            });
        });

        data.pharmacyPayments.forEach(item => {
            allItems.push({
                date: item.date,
                secuAmount: item.secuAmount,
                mutuelleAmount: item.mutuelleAmount,
                total: item.total
            });
        });

        TableManager.sortItems(allItems, AppState.currentSortOrder);
        
        let rows = '';
        allItems.forEach(item => {
            rows += `
                <tr>
                    <td>${item.date}</td>
                    <td class="amount-cell positive">${Utils.formatCurrency(item.secuAmount)}</td>
                    <td class="amount-cell positive">${Utils.formatCurrency(item.mutuelleAmount)}</td>
                    <td class="amount-cell positive"><strong>${Utils.formatCurrency(item.total)}</strong></td>
                </tr>
            `;
        });

        tbody.innerHTML = rows;
    },

    sortItems(items, order) {
        items.sort((a, b) => {
            const dateA = Utils.parseDate(a.date);
            const dateB = Utils.parseDate(b.date);
            
            return order === 'asc' ? dateA - dateB : dateB - dateA;
        });
    }
};

// Gestionnaire des cotisations
const CotisationsManager = {
    display(data) {
        const cotisationsContent = document.getElementById('cotisationsContent');
        const years = Object.keys(data.totalByYear).sort((a, b) => b - a);
        
        if (years.length === 0) return;
        
        if (!AppState.selectedYear) {
            AppState.selectedYear = years[0];
        }
        
        let yearOptions = '';
        years.forEach(year => {
            const isSelected = year === AppState.selectedYear ? 'selected' : '';
            yearOptions += `<option value="${year}" ${