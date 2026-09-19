import { JSDOM } from 'jsdom';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { NotesDataProvider } from '../src/dataProviders/NotesDataProvider.js';

describe('NotesDataProvider', () => {
    let logger;
    let notifier;
    let provider;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>', {
            url: 'https://esfera.example/finalAvaluacioGrupAlumne/77',
        });
        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = dom.window.localStorage;

        logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
        notifier = { error: jest.fn(), warn: jest.fn(), info: jest.fn() };
        provider = new NotesDataProvider(logger, { normalitzaAlumne: jest.fn() }, notifier);
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.localStorage;
    });

    describe('obtéMaxAvaluacions', () => {
        test('hauria de retornar null i avisar quan Angular no hi és', async () => {
            jest.spyOn(provider, 'obtéInjectorAngular').mockReturnValue(null);

            expect(await provider.obtéMaxAvaluacions()).toBeNull();
            expect(notifier.error).toHaveBeenCalledWith(expect.stringContaining("nombre d'avaluacions"));
        });

        test('hauria de retornar null i avisar quan la petició peta, sense inventar cap valor', async () => {
            jest.spyOn(provider, 'obtéInjectorAngular').mockReturnValue({ get: jest.fn() });
            jest.spyOn(provider, 'obtéAvaluacioFactory').mockReturnValue({});
            jest.spyOn(provider, 'extractIdMatricula').mockResolvedValue([{ idMatricula: 1 }]);
            jest.spyOn(provider, 'fetchAvaluacioData').mockRejectedValue(new Error('500'));

            expect(await provider.obtéMaxAvaluacions()).toBeNull();
            expect(notifier.error).toHaveBeenCalledTimes(1);
        });

        test('hauria de retornar null quan la resposta no porta la llista d’avaluacions', async () => {
            jest.spyOn(provider, 'obtéInjectorAngular').mockReturnValue({ get: jest.fn() });
            jest.spyOn(provider, 'obtéAvaluacioFactory').mockReturnValue({});
            jest.spyOn(provider, 'extractIdMatricula').mockResolvedValue([{ idMatricula: 1 }]);
            jest.spyOn(provider, 'fetchAvaluacioData').mockResolvedValue({});

            expect(await provider.obtéMaxAvaluacions()).toBeNull();
            expect(notifier.error).toHaveBeenCalledTimes(1);
        });

        test('hauria de retornar el nombre real quan Esfer@ el dona', async () => {
            jest.spyOn(provider, 'obtéInjectorAngular').mockReturnValue({ get: jest.fn() });
            jest.spyOn(provider, 'obtéAvaluacioFactory').mockReturnValue({});
            jest.spyOn(provider, 'extractIdMatricula').mockResolvedValue([{ idMatricula: 1 }]);
            jest.spyOn(provider, 'fetchAvaluacioData').mockResolvedValue({ lAvaluacions: [1, 2, 3] });

            expect(await provider.obtéMaxAvaluacions()).toBe(3);
            expect(notifier.error).not.toHaveBeenCalled();
        });
    });

    describe('obtéDadesExportació', () => {
        const preparaGrup = (matricules) => {
            jest.spyOn(provider, 'obtéInjectorAngular').mockReturnValue({ get: jest.fn() });
            jest.spyOn(provider, 'obtéAvaluacioFactory').mockReturnValue({});
            jest.spyOn(provider, 'extractIdMatricula').mockResolvedValue(matricules);
        };

        test('hauria d’informar del progrés amb el total real d’alumnes', async () => {
            preparaGrup([
                { idMatricula: 1, nomComplet: 'Anna', nomGrup: 'SMX1' },
                { idMatricula: 2, nomComplet: 'Pau', nomGrup: 'SMX1' },
            ]);
            jest.spyOn(provider, 'obtéDadesAlumne').mockResolvedValue({ success: true });
            const progrés = [];

            await provider.obtéDadesExportació((actual, total) => progrés.push([actual, total]));

            expect(progrés).toEqual([[0, 2], [1, 2], [2, 2]]);
        });

        test('hauria de recollir com a incidència l’alumne que no s’ha pogut carregar', async () => {
            preparaGrup([
                { idMatricula: 1, nomComplet: 'Anna', nomGrup: 'SMX1' },
                { idMatricula: 2, nomComplet: 'Pau', nomGrup: 'SMX1' },
            ]);
            jest.spyOn(provider, 'obtéDadesAlumne')
                .mockResolvedValueOnce({ success: true, nom: 'Anna' })
                .mockResolvedValueOnce({ error: true, nom: 'Pau' });

            const dades = await provider.obtéDadesExportació();

            expect(dades.incidències).toEqual([{ nom: 'Pau', motiu: 'error en la petició' }]);
        });

        test('hauria de funcionar sense reporter de progrés', async () => {
            preparaGrup([{ idMatricula: 1, nomComplet: 'Anna', nomGrup: 'SMX1' }]);
            jest.spyOn(provider, 'obtéDadesAlumne').mockResolvedValue({ success: true });

            const dades = await provider.obtéDadesExportació();

            expect(dades.nomGrup).toBe('SMX1');
            expect(dades.incidències).toEqual([]);
        });
    });
});
