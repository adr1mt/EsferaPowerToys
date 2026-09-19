import { JSDOM } from 'jsdom';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BotóProgrés } from '../src/BotóProgrés.js';

describe('BotóProgrés', () => {
    let botó;

    beforeEach(() => {
        const dom = new JSDOM('<!doctype html><html><body></body></html>');
        global.window = dom.window;
        global.document = dom.window.document;
        botó = document.createElement('button');
        botó.textContent = 'Descarregar';
        document.body.appendChild(botó);
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
    });

    test('hauria de desactivar el botó mentre corre i restaurar-lo en acabar', async () => {
        const progrés = new BotóProgrés(botó);

        const tasca = progrés.executa('Exportant...', async () => {
            expect(botó.disabled).toBe(true);
            expect(botó.textContent).toBe('Exportant...');
        });
        await tasca;

        expect(botó.disabled).toBe(false);
        expect(botó.textContent).toBe('Descarregar');
    });

    test('hauria de restaurar el botó encara que la tasca peti', async () => {
        const progrés = new BotóProgrés(botó);

        await progrés.executa('Exportant...', async () => {
            throw new Error('petada');
        }).catch(() => {});

        expect(botó.disabled).toBe(false);
        expect(botó.textContent).toBe('Descarregar');
    });

    test('hauria de mostrar el progrés real quan se’n coneix el total', async () => {
        const progrés = new BotóProgrés(botó);
        const textos = [];

        await progrés.executa('Exportant...', async (informaProgrés) => {
            informaProgrés(0, 30);
            textos.push(botó.textContent);
            informaProgrés(12, 30);
            textos.push(botó.textContent);
        });

        expect(textos).toEqual(['Exportant... 0/30', 'Exportant... 12/30']);
    });

    test('hauria de mostrar només l’estat quan el total és desconegut', async () => {
        const progrés = new BotóProgrés(botó);
        let text = null;

        await progrés.executa('Carregant...', async (informaProgrés) => {
            informaProgrés(3, 0);
            text = botó.textContent;
        });

        expect(text).toBe('Carregant...');
    });

    test('hauria d’ignorar un segon clic mentre l’operació està en curs', async () => {
        const progrés = new BotóProgrés(botó);
        const tasca = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 5)));

        const primera = progrés.executa('Exportant...', tasca);
        await progrés.executa('Exportant...', tasca);
        await primera;

        expect(tasca).toHaveBeenCalledTimes(1);
    });

    test('hauria de restaurar el text que toca segons l’estat actual', async () => {
        let etiqueta = 'Descarregar avaluació 1';
        const progrés = new BotóProgrés(botó, () => etiqueta);

        await progrés.executa('Exportant...', async () => {
            etiqueta = 'Descarregar avaluació 2';
        });

        expect(botó.textContent).toBe('Descarregar avaluació 2');
    });
});
