import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ExcelExportManager } from '../src/excel/ExcelExportManager.js';
import { PowerToysLogger } from '../src/PowerToysLogger.js';
import { NotesAggregationHelper } from '../src/dataProviders/NotesAggregationHelper.js';

describe('ExcelExportManager', () => {
    let dom;
    let manager;
    let originalBlob;
    let originalUrl;
    let clickedDownload;
    let dataProvider;
    let workbookBuilder;
    let notifier;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
        global.document = dom.window.document;
        global.window = dom.window;

        originalBlob = global.Blob;
        originalUrl = global.URL;
        clickedDownload = null;

        global.Blob = jest.fn(function (parts, options) {
            this.parts = parts;
            this.options = options;
        });
        global.URL = {
            createObjectURL: jest.fn(() => 'blob:test'),
            revokeObjectURL: jest.fn(),
        };

        jest.spyOn(dom.window.HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            clickedDownload = this.download;
        });

        dataProvider = {
            obtéDadesExportació: jest.fn(),
            obtéMaxAvaluacions: jest.fn(),
        };
        workbookBuilder = {
            construeixWorkbookNotes: jest.fn(() => ({
                xlsx: {
                    writeBuffer: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
                },
            })),
            construeixWorkbookTotesLesAvaluacions: jest.fn(() => ({
                xlsx: {
                    writeBuffer: jest.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
                },
            })),
        };
        notifier = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            avisaIncidències: jest.fn(),
        };
        manager = new ExcelExportManager(
            new PowerToysLogger(false),
            dataProvider,
            workbookBuilder,
            undefined,
            notifier,
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.Blob = originalBlob;
        global.URL = originalUrl;
        delete global.document;
        delete global.window;
    });

    test('hauria de descarregar un fitxer XLSX amb el tipus Blob correcte', async () => {
        const dadesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];

        await manager.descarregaXLSX(dadesAlumnes, 1, 'Grup Test');

        expect(workbookBuilder.construeixWorkbookNotes).toHaveBeenCalledWith(dadesAlumnes, 1);
        expect(global.Blob).toHaveBeenCalledWith(
            [expect.any(Uint8Array)],
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        );
        expect(clickedDownload).toMatch(/^Esfera_Notes_av_1_\d{4}-\d{2}-\d{2}_Grup Test\.xlsx$/);
        expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(global.Blob));
        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    test('hauria de coordinar proveïdor, constructor i descàrrega per a l’avaluació seleccionada', async () => {
        const notesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];
        dataProvider.obtéDadesExportació.mockResolvedValue({ notesAlumnes, nomGrup: 'Grup Test' });

        await manager.procésDescàrregaExcel(2);

        expect(dataProvider.obtéDadesExportació).toHaveBeenCalledTimes(1);
        expect(workbookBuilder.construeixWorkbookNotes).toHaveBeenCalledWith(notesAlumnes, 2);
        expect(clickedDownload).toMatch(/^Esfera_Notes_av_2_\d{4}-\d{2}-\d{2}_Grup Test\.xlsx$/);
    });

    test('hauria de coordinar proveïdor, constructor i descàrrega per a totes les avaluacions', async () => {
        const notesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];
        dataProvider.obtéDadesExportació.mockResolvedValue({ notesAlumnes, nomGrup: 'Grup Test' });
        dataProvider.obtéMaxAvaluacions.mockResolvedValue(3);

        await manager.procésDescàrregaTotesLesAvaluacions();

        expect(dataProvider.obtéDadesExportació).toHaveBeenCalledTimes(1);
        expect(dataProvider.obtéMaxAvaluacions).toHaveBeenCalledTimes(1);
        expect(workbookBuilder.construeixWorkbookTotesLesAvaluacions).toHaveBeenCalledWith(notesAlumnes, 3);
        expect(clickedDownload).toMatch(/^Esfera_Notes_Totes_Av_\d{4}-\d{2}-\d{2}_Grup Test\.xlsx$/);
    });

    test('hauria de tractar el mode agregat canònic com a descàrrega de totes les avaluacions', async () => {
        const notesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];
        dataProvider.obtéDadesExportació.mockResolvedValue({ notesAlumnes, nomGrup: 'Grup Test' });
        dataProvider.obtéMaxAvaluacions.mockResolvedValue(3);

        await manager.procésDescàrregaExcel(NotesAggregationHelper.MODE_AGREGAT);

        expect(workbookBuilder.construeixWorkbookNotes).not.toHaveBeenCalled();
        expect(workbookBuilder.construeixWorkbookTotesLesAvaluacions).toHaveBeenCalledWith(notesAlumnes, 3);
    });

    test('hauria d’aturar-se sense descarregar res quan no hi ha dades', async () => {
        dataProvider.obtéDadesExportació.mockResolvedValue(null);

        await manager.procésDescàrregaExcel(1);

        expect(workbookBuilder.construeixWorkbookNotes).not.toHaveBeenCalled();
        expect(clickedDownload).toBeNull();
    });

    test('hauria d’avisar de les incidències abans de descarregar', async () => {
        const notesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];
        const incidències = [{ nom: 'Pau', motiu: 'error en la petició' }];
        dataProvider.obtéDadesExportació.mockResolvedValue({ notesAlumnes, nomGrup: 'Grup Test', incidències });

        await manager.procésDescàrregaExcel(1);

        expect(notifier.avisaIncidències).toHaveBeenCalledWith(incidències, 'Exportació a Excel');
        expect(clickedDownload).not.toBeNull();
    });

    test('hauria de notificar l’error quan la generació del workbook peta', async () => {
        dataProvider.obtéDadesExportació.mockResolvedValue({
            notesAlumnes: [{ idAlumne: '1', nom: 'Alumna', continguts: {} }],
            nomGrup: 'Grup Test',
            incidències: [],
        });
        workbookBuilder.construeixWorkbookNotes.mockImplementation(() => {
            throw new Error('exceljs no carregat');
        });

        await manager.procésDescàrregaExcel(1);

        expect(notifier.error).toHaveBeenCalledWith(
            expect.stringContaining('exceljs no carregat'),
            expect.any(Error),
        );
    });
});
