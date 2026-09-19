import { JSDOM } from 'jsdom';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ExcelUIBuilder } from '../src/excel/ExcelUIBuilder.js';
import { NotesAggregationHelper } from '../src/dataProviders/NotesAggregationHelper.js';

describe('ExcelUIBuilder', () => {
    /** Proveïdor que sap quantes avaluacions hi ha: sense això no es crea cap panell. */
    const dataProviderAmb = (maxAvaluacions = 4) => ({
        obtéMaxAvaluacions: jest.fn().mockResolvedValue(maxAvaluacions),
    });

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    test('hauria d’afegir el botó de visualització amb la mateixa avaluació seleccionada', async () => {
        const onDownload = jest.fn();
        const onVisualize = jest.fn();
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, onDownload, containerBuilder, onVisualize, dataProviderAmb());

        const panel = await builder.createPanel(document.createElement('table'));
        const select = panel.querySelector('#powertoys-evaluation-select');
        select.value = '2';
        select.dispatchEvent(new window.Event('change'));
        panel.querySelector('#btn-visualitzar-dades').click();
        panel.querySelector('#btn-descargar-xlsx').click();
        await Promise.resolve();
        await Promise.resolve();

        expect(panel.querySelector('#btn-visualitzar-dades').textContent).toBe('Visualització avaluació 2');
        expect(panel.querySelector('#powertoys-evaluation-select').classList.contains('powertoy-excel-evaluation-select')).toBe(true);
        expect(panel.querySelector('#btn-descargar-xlsx').classList.contains('powertoy-excel-download-button')).toBe(true);
        expect(panel.querySelector('#btn-visualitzar-dades').classList.contains('powertoy-excel-visualize-button')).toBe(true);
        expect(onVisualize).toHaveBeenCalledWith(2, expect.any(Function));
        expect(onDownload).toHaveBeenCalledWith(2, expect.any(Function));
    });

    test('hauria d’activar la descàrrega agregada pel callback de descàrrega normal', async () => {
        const onDownload = jest.fn();
        const onDownloadAll = jest.fn();
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, onDownload, containerBuilder, null, dataProviderAmb(), onDownloadAll);

        const panel = await builder.createPanel(document.createElement('table'));
        panel.querySelector('#powertoys-evaluation-select').value = 'agregat';
        panel.querySelector('#btn-descargar-xlsx').click();

        expect(onDownload).toHaveBeenCalledWith(NotesAggregationHelper.MODE_AGREGAT, expect.any(Function));
        expect(onDownloadAll).not.toHaveBeenCalled();
    });

    test('hauria de descarregar agregat encara que no hi hagi callback antic de totes les avaluacions', async () => {
        const onDownload = jest.fn();
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, onDownload, containerBuilder, null, dataProviderAmb());

        const panel = await builder.createPanel(document.createElement('table'));
        panel.querySelector('#powertoys-evaluation-select').value = 'agregat';

        expect(() => panel.querySelector('#btn-descargar-xlsx').click()).not.toThrow();
        expect(onDownload).toHaveBeenCalledWith(NotesAggregationHelper.MODE_AGREGAT, expect.any(Function));
    });

    test('hauria d’enviar agregat al visualitzador quan se seleccionen totes les avaluacions', async () => {
        const onVisualize = jest.fn();
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, jest.fn(), containerBuilder, onVisualize, dataProviderAmb());

        const panel = await builder.createPanel(document.createElement('table'));
        panel.querySelector('#powertoys-evaluation-select').value = 'agregat';
        panel.querySelector('#btn-visualitzar-dades').click();

        expect(onVisualize).toHaveBeenCalledWith('agregat', expect.any(Function));
        expect(onVisualize).not.toHaveBeenCalledWith(1, expect.any(Function));
        expect(onVisualize).not.toHaveBeenCalledWith(NaN, expect.any(Function));
    });

    test('hauria de bloquejar el botó mentre exporta i no permetre reentrada', async () => {
        let resol;
        const onDownload = jest.fn(() => new Promise((r) => { resol = r; }));
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, onDownload, containerBuilder, null, dataProviderAmb());

        const panel = await builder.createPanel(document.createElement('table'));
        const downloadButton = panel.querySelector('#btn-descargar-xlsx');

        downloadButton.click();
        await Promise.resolve();
        expect(downloadButton.disabled).toBe(true);
        expect(downloadButton.textContent).toBe('Exportant...');

        downloadButton.click();
        await Promise.resolve();
        expect(onDownload).toHaveBeenCalledTimes(1);

        resol();
        await Promise.resolve();
        await Promise.resolve();
        expect(downloadButton.disabled).toBe(false);
        expect(downloadButton.textContent).toBe('Descarregar Excel totes les avaluacions (agregat)');
    });

    test('hauria de mostrar el progrés real que rep de l’exportació', async () => {
        const onDownload = jest.fn(async (evaluation, informaProgrés) => informaProgrés(12, 30));
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, onDownload, containerBuilder, null, dataProviderAmb());

        const panel = await builder.createPanel(document.createElement('table'));
        const downloadButton = panel.querySelector('#btn-descargar-xlsx');
        const textos = [];
        onDownload.mockImplementation(async (evaluation, informaProgrés) => {
            informaProgrés(12, 30);
            textos.push(downloadButton.textContent);
        });

        downloadButton.click();
        await Promise.resolve();
        await Promise.resolve();

        expect(textos).toEqual(['Exportant... 12/30']);
    });

    test('no hauria de crear cap panell si no se sap el nombre d’avaluacions', async () => {
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder(
            { log: jest.fn() }, jest.fn(), containerBuilder, jest.fn(), dataProviderAmb(null),
        );

        const panel = await builder.createPanel(document.createElement('table'));

        expect(panel).toBeNull();
        expect(containerBuilder.createContainer).not.toHaveBeenCalled();
    });

    test('hauria de mostrar el text inicial de descàrrega i visualització per a totes', async () => {
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, jest.fn(), containerBuilder, jest.fn(), dataProviderAmb());

        const panel = await builder.createPanel(document.createElement('table'));

        expect(panel.querySelector('#powertoys-evaluation-select').value).toBe('agregat');
        expect(panel.querySelector('#btn-descargar-xlsx').textContent).toBe('Descarregar Excel totes les avaluacions (agregat)');
        expect(panel.querySelector('#btn-visualitzar-dades').textContent).toBe('Visualització agregats');
    });

    test('hauria de canviar el text dels botons per a totes i restaurar-lo per avaluació numèrica', async () => {
        const containerBuilder = {
            createContainer: jest.fn((content) => content),
        };
        const builder = new ExcelUIBuilder({ log: jest.fn() }, jest.fn(), containerBuilder, jest.fn(), dataProviderAmb());

        const panel = await builder.createPanel(document.createElement('table'));
        const select = panel.querySelector('#powertoys-evaluation-select');
        const downloadButton = panel.querySelector('#btn-descargar-xlsx');
        const visualizeButton = panel.querySelector('#btn-visualitzar-dades');

        expect(downloadButton.textContent).toBe('Descarregar Excel totes les avaluacions (agregat)');
        expect(visualizeButton.textContent).toBe('Visualització agregats');

        select.value = '2';
        select.dispatchEvent(new window.Event('change'));
        expect(downloadButton.textContent).toBe('Descarregar Excel avaluació 2');
        expect(visualizeButton.textContent).toBe('Visualització avaluació 2');

        select.value = 'agregat';
        select.dispatchEvent(new window.Event('change'));
        expect(downloadButton.textContent).toBe('Descarregar Excel totes les avaluacions (agregat)');
        expect(visualizeButton.textContent).toBe('Visualització agregats');
    });
});
