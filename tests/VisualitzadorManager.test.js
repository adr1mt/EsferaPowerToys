import { jest, describe, test, expect } from '@jest/globals';
import { VisualitzadorManager } from '../src/visualitzador/VisualitzadorManager.js';

describe('VisualitzadorManager', () => {
    test('hauria d’obrir el visualitzador agregat quan l’avaluació és agregat', async () => {
        const notesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];
        const dataProvider = {
            obtéDadesExportació: jest.fn().mockResolvedValue({ notesAlumnes }),
            obtéMaxAvaluacions: jest.fn().mockResolvedValue(3),
        };
        const modelBuilder = {
            construeixModel: jest.fn(() => ({ students: [{ id: '1' }] })),
        };
        const modal = {
            open: jest.fn(),
        };
        const manager = new VisualitzadorManager({ log: jest.fn(), error: jest.fn() }, dataProvider, modelBuilder, modal);

        await manager.obreVisualitzador('agregat');

        expect(dataProvider.obtéMaxAvaluacions).toHaveBeenCalledTimes(1);
        expect(modelBuilder.construeixModel).toHaveBeenCalledWith(notesAlumnes, 'agregat', 3);
        expect(modelBuilder.construeixModel).not.toHaveBeenCalledWith(notesAlumnes, 1, expect.anything());
        expect(modelBuilder.construeixModel).not.toHaveBeenCalledWith(notesAlumnes, NaN, expect.anything());
        expect(modal.open).toHaveBeenCalledWith([{ id: '1' }], 'Visualitzant: Totes les avaluacions (agregat)');
    });

    test('hauria d’obrir el visualitzador amb el context d’una avaluació numèrica', async () => {
        const notesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];
        const dataProvider = {
            obtéDadesExportació: jest.fn().mockResolvedValue({ notesAlumnes }),
            obtéMaxAvaluacions: jest.fn(),
        };
        const modelBuilder = {
            construeixModel: jest.fn(() => ({ students: [{ id: '1' }] })),
        };
        const modal = {
            open: jest.fn(),
        };
        const manager = new VisualitzadorManager({ log: jest.fn(), error: jest.fn() }, dataProvider, modelBuilder, modal);

        await manager.obreVisualitzador(2);

        expect(dataProvider.obtéMaxAvaluacions).not.toHaveBeenCalled();
        expect(modelBuilder.construeixModel).toHaveBeenCalledWith(notesAlumnes, 2, 0);
        expect(modal.open).toHaveBeenCalledWith([{ id: '1' }], 'Visualitzant: Avaluació 2');
    });

    test('hauria d’aturar-se sense obrir el modal quan no hi ha dades', async () => {
        const dataProvider = {
            obtéDadesExportació: jest.fn().mockResolvedValue(null),
            obtéMaxAvaluacions: jest.fn(),
        };
        const modelBuilder = { construeixModel: jest.fn() };
        const modal = { open: jest.fn() };
        const notifier = { error: jest.fn(), warn: jest.fn(), confirmaIncidències: jest.fn(() => true) };
        const manager = new VisualitzadorManager(
            { log: jest.fn(), error: jest.fn() }, dataProvider, modelBuilder, modal, undefined, notifier,
        );

        await manager.obreVisualitzador(1);

        expect(modal.open).not.toHaveBeenCalled();
        expect(modelBuilder.construeixModel).not.toHaveBeenCalled();
    });

    test('hauria de demanar confirmació de les incidències en obrir el visualitzador', async () => {
        const notesAlumnes = [{ idAlumne: '1', nom: 'Alumna', continguts: {} }];
        const incidències = [{ nom: 'Anna', motiu: 'sense dades' }];
        const dataProvider = {
            obtéDadesExportació: jest.fn().mockResolvedValue({ notesAlumnes, incidències }),
            obtéMaxAvaluacions: jest.fn(),
        };
        const modelBuilder = { construeixModel: jest.fn(() => ({ students: [{ id: '1' }] })) };
        const modal = { open: jest.fn() };
        const notifier = { error: jest.fn(), warn: jest.fn(), confirmaIncidències: jest.fn(() => true) };
        const manager = new VisualitzadorManager(
            { log: jest.fn(), error: jest.fn() }, dataProvider, modelBuilder, modal, undefined, notifier,
        );

        await manager.obreVisualitzador(2);

        expect(notifier.confirmaIncidències).toHaveBeenCalledWith(incidències, 'Visualitzador');
        expect(modal.open).toHaveBeenCalled();
    });

    test('hauria d’avortar el visualitzador si no es confirmen les incidències', async () => {
        const dataProvider = {
            obtéDadesExportació: jest.fn().mockResolvedValue({
                notesAlumnes: [{ idAlumne: '1', nom: 'Alumna', continguts: {} }],
                incidències: [{ nom: 'Anna', motiu: 'sense dades' }],
            }),
            obtéMaxAvaluacions: jest.fn(),
        };
        const modelBuilder = { construeixModel: jest.fn() };
        const modal = { open: jest.fn() };
        const notifier = { error: jest.fn(), warn: jest.fn(), confirmaIncidències: jest.fn(() => false) };
        const manager = new VisualitzadorManager(
            { log: jest.fn(), error: jest.fn() }, dataProvider, modelBuilder, modal, undefined, notifier,
        );

        await manager.obreVisualitzador(2);

        expect(modelBuilder.construeixModel).not.toHaveBeenCalled();
        expect(modal.open).not.toHaveBeenCalled();
    });

    test('hauria d’aturar l’agregat quan no se sap el nombre d’avaluacions', async () => {
        const dataProvider = {
            obtéDadesExportació: jest.fn().mockResolvedValue({ notesAlumnes: [], incidències: [] }),
            obtéMaxAvaluacions: jest.fn().mockResolvedValue(null),
        };
        const modelBuilder = { construeixModel: jest.fn() };
        const modal = { open: jest.fn() };
        const notifier = { error: jest.fn(), warn: jest.fn(), confirmaIncidències: jest.fn(() => true) };
        const manager = new VisualitzadorManager(
            { log: jest.fn(), error: jest.fn() }, dataProvider, modelBuilder, modal, undefined, notifier,
        );

        await manager.obreVisualitzador('agregat');

        expect(modelBuilder.construeixModel).not.toHaveBeenCalled();
        expect(modal.open).not.toHaveBeenCalled();
    });

    test('hauria de notificar l’error quan el modal peta', async () => {
        const dataProvider = {
            obtéDadesExportació: jest.fn().mockResolvedValue({ notesAlumnes: [], incidències: [] }),
            obtéMaxAvaluacions: jest.fn(),
        };
        const modelBuilder = { construeixModel: jest.fn(() => ({ students: [] })) };
        const modal = { open: jest.fn(() => { throw new Error('modal trencat'); }) };
        const notifier = { error: jest.fn(), warn: jest.fn(), confirmaIncidències: jest.fn(() => true) };
        const manager = new VisualitzadorManager(
            { log: jest.fn(), error: jest.fn() }, dataProvider, modelBuilder, modal, undefined, notifier,
        );

        await manager.obreVisualitzador(1);

        expect(notifier.error).toHaveBeenCalledWith(
            expect.stringContaining('modal trencat'),
            expect.any(Error),
        );
    });
});
