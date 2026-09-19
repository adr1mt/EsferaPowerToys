import { NotesAggregationHelper } from '../dataProviders/NotesAggregationHelper.js';
import { BotóProgrés } from '../BotóProgrés.js';

/**
 * Classe per a la creació i gestió del panell de descàrrega de notes en Excel.
 */
export class ExcelUIBuilder {
    /**
     * @param {import('../PowerToysLogger.js').PowerToysLogger} logger
     * @param {function} onDownload Callback activat a l'apretar el botó d'Excel
     * @param {import('../ContainerUIBuilder.js').ContainerUIBuilder} containerBuilder - Constructor base del contenidor.
     * @param {function} onVisualize Callback activat a l'apretar el botó del visualitzador
     * @param {import('../dataProviders/NotesDataProvider.js').NotesDataProvider} dataProvider - Proveïdor de dades de notes.
     */
    constructor(logger, onDownload, containerBuilder, onVisualize = null, dataProvider = null) {
        this.logger = logger;
        this.onDownload = onDownload;
        this.containerBuilder = containerBuilder;
        this.onVisualize = onVisualize;
        this.dataProvider = dataProvider;
        /** @type {number|null} Desconegut mentre sigui null: mai s'inventa. */
        this.maxAvaluacions = null;
    }

    async updateMaxAvaluacions() {
        if (!this.dataProvider) return;
        this.maxAvaluacions = await this.dataProvider.obtéMaxAvaluacions();
    }

    /**
     * Crea el panell informatiu amb els controls d'Excel i visualització.
     * @param {string} id - Identificador del contenidor del panell.
     * @returns {HTMLElement} Panell preparat per inserir al DOM.
     */
    async createPanel(table = null, id = 'powertoys-info-box') {
        const contentDiv = document.createElement('div');
        const panelContent = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = 'PowerToys - Exportació Excel';

        const helpText = document.createElement('span');
        helpText.className = 'powertoy-excel-help-text';
        helpText.textContent = "Selecciona l'avaluació per descarregar les notes:";

        await this.updateMaxAvaluacions();

        // Comprovem de nou després de l'espera per evitar duplicitats si l'observador s'ha disparat varies vegades
        if (table && table.previousElementSibling?.id === id) {
            return null;
        }

        // Sense saber quantes avaluacions hi ha no es pot oferir el panell: el proveïdor ja ho ha notificat.
        if (!(this.maxAvaluacions > 0)) {
            this.logger.log('ExcelUIBuilder → panell no creat: nombre d’avaluacions desconegut');
            return null;
        }

        const select = document.createElement('select');
        select.id = 'powertoys-evaluation-select';
        select.className = 'powertoy-excel-evaluation-select';
        const optionTotes = document.createElement('option');
        optionTotes.value = NotesAggregationHelper.MODE_AGREGAT;
        optionTotes.textContent = `Totes les avaluacions (Agregat)`;
        select.appendChild(optionTotes);
        for (let i = 1; i <= this.maxAvaluacions; i++) {
            const option = document.createElement('option');
            option.value = `${i}`;
            option.textContent = `Avaluació ${i}`;
            select.appendChild(option);
        }

        const actions = document.createElement('div');
        actions.className = 'powertoy-excel-actions';

        const downloadButton = document.createElement('button');
        downloadButton.id = 'btn-descargar-xlsx';
        downloadButton.className = 'powertoy-excel-button powertoy-excel-download-button';
        downloadButton.textContent = this.obtéTextBotóDescarrega(select.value);

        const visualizeButton = document.createElement('button');
        visualizeButton.id = 'btn-visualitzar-dades';
        visualizeButton.className = 'powertoy-excel-button powertoy-excel-visualize-button';
        visualizeButton.textContent = this.obtéTextBotóVisualitzador(select.value);

        actions.appendChild(downloadButton);
        actions.appendChild(visualizeButton);


        panelContent.appendChild(title);
        panelContent.appendChild(document.createElement('br'));
        panelContent.appendChild(helpText);
        panelContent.appendChild(document.createElement('br'));
        panelContent.appendChild(select);
        panelContent.appendChild(actions);
        contentDiv.appendChild(panelContent);

        const container = this.containerBuilder.createContainer(contentDiv, id);

        const btnExcel = container.querySelector('#btn-descargar-xlsx');
        const selectAvaluacio = container.querySelector('#powertoys-evaluation-select');
        if (btnExcel) {
            const progrésDescàrrega = new BotóProgrés(
                btnExcel,
                () => this.obtéTextBotóDescarrega(selectAvaluacio?.value),
            );
            btnExcel.addEventListener('click', () => {
                const evaluation = this.obtéAvaluacioSeleccionada(selectAvaluacio);
                progrésDescàrrega.executa('Exportant...', (informaProgrés) => this.onDownload(evaluation, informaProgrés));
            });
        }

        const btnVisualitzar = container.querySelector('#btn-visualitzar-dades');
        if (selectAvaluacio && btnVisualitzar && btnExcel) {
            selectAvaluacio.addEventListener('change', () => {
                if (!btnExcel.disabled) btnExcel.textContent = this.obtéTextBotóDescarrega(selectAvaluacio.value);
                if (!btnVisualitzar.disabled) btnVisualitzar.textContent = this.obtéTextBotóVisualitzador(selectAvaluacio.value);
            });
        }

        if (btnVisualitzar && this.onVisualize) {
            const progrésVisualització = new BotóProgrés(
                btnVisualitzar,
                () => this.obtéTextBotóVisualitzador(selectAvaluacio?.value),
            );
            btnVisualitzar.addEventListener('click', () => {
                const evaluation = this.obtéAvaluacioSeleccionada(selectAvaluacio);
                progrésVisualització.executa('Carregant...', (informaProgrés) => this.onVisualize(evaluation, informaProgrés));
            });
        }

        this.logger.log('ExcelUIBuilder → panell creat');
        return container;
    }

    /**
     * Obté el mode seleccionat: agregat canònic o avaluació numèrica segura.
     * @param {HTMLSelectElement|null} selectAvaluacio
     * @returns {number|typeof NotesAggregationHelper.MODE_AGREGAT}
     */
    obtéAvaluacioSeleccionada(selectAvaluacio) {
        if (selectAvaluacio?.value === NotesAggregationHelper.MODE_AGREGAT) {
            return NotesAggregationHelper.MODE_AGREGAT;
        }

        const evaluation = selectAvaluacio ? parseInt(selectAvaluacio.value, 10) : 1;
        return Number.isNaN(evaluation) ? 1 : evaluation;
    }

    /**
     * Obté el text del botó de descàrrega segons l'avaluació seleccionada.
     * @param {string} evaluation
     * @returns {string}
     */
    obtéTextBotóDescarrega(evaluation) {
        return evaluation === NotesAggregationHelper.MODE_AGREGAT
            ? 'Descarregar Excel totes les avaluacions (agregat)'
            : 'Descarregar Excel avaluació ' + evaluation;
    }

    /**
     * Obté el text del botó del visualitzador segons l'avaluació seleccionada.
     * @param {string} evaluation
     * @returns {string}
     */
    obtéTextBotóVisualitzador(evaluation) {
        return evaluation === NotesAggregationHelper.MODE_AGREGAT
            ? 'Visualització agregats'
            : 'Visualització avaluació ' + evaluation;
    }
}
