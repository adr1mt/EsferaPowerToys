import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { Notifier } from '../src/Notifier.js';

describe('Notifier', () => {
    let dom;
    let notifier;
    let logger;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
        global.document = dom.window.document;
        global.window = dom.window;
        logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
        notifier = new Notifier(logger);
    });

    afterEach(() => {
        delete global.document;
        delete global.window;
        jest.useRealTimers();
    });

    test('mostra un error visible amb rol alert', () => {
        notifier.error('Ha petat');

        const avís = document.querySelector('.powertoy-notice--error');
        expect(avís).not.toBeNull();
        expect(avís.getAttribute('role')).toBe('alert');
        expect(avís.querySelector('.powertoy-notice-text').textContent).toBe('Ha petat');
        expect(logger.error).toHaveBeenCalled();
    });

    test('injecta els estils una sola vegada', () => {
        notifier.error('un');
        notifier.warn('dos');

        expect(document.querySelectorAll('#powertoy-notice-styles')).toHaveLength(1);
    });

    test('no duplica missatges idèntics del mateix tipus', () => {
        notifier.warn('Mateix avís');
        notifier.warn('Mateix avís');

        expect(document.querySelectorAll('.powertoy-notice--warn')).toHaveLength(1);
    });

    test('distingeix missatges iguals de tipus diferent', () => {
        notifier.warn('Text');
        notifier.error('Text');

        expect(document.querySelectorAll('.powertoy-notice')).toHaveLength(2);
    });

    test('el botó de tancar treu el missatge', () => {
        notifier.error('Tanca(m)');

        document.querySelector('.powertoy-notice-close').dispatchEvent(
            new dom.window.Event('click', { bubbles: true }),
        );

        expect(document.querySelector('.powertoy-notice')).toBeNull();
    });

    test("la informació s'amaga sola i l'error no", () => {
        jest.useFakeTimers();

        notifier.info('Informatiu');
        notifier.error('Persistent');
        jest.advanceTimersByTime(Notifier.DURADA_INFO + 1);

        expect(document.querySelector('.powertoy-notice--info')).toBeNull();
        expect(document.querySelector('.powertoy-notice--error')).not.toBeNull();
    });

    test('avisaIncidències informa del nombre i dels noms', () => {
        notifier.avisaIncidències(
            [{ nom: 'Anna', motiu: 'sense dades' }, { nom: 'Pau', motiu: 'error en la petició' }],
            'Exportació a Excel',
        );

        const text = document.querySelector('.powertoy-notice--warn .powertoy-notice-text').textContent;
        expect(text).toContain('2 alumnes');
        expect(text).toContain('Anna');
        expect(text).toContain('Pau');
        expect(text).toContain('incompletes');
    });

    test('avisaIncidències no mostra res quan no hi ha incidències', () => {
        expect(notifier.avisaIncidències([], 'Exportació a Excel')).toBeNull();
        expect(document.querySelector('.powertoy-notice')).toBeNull();
    });

    test('neteja treu tots els missatges', () => {
        notifier.error('un');
        notifier.warn('dos');
        notifier.neteja();

        expect(document.querySelectorAll('.powertoy-notice')).toHaveLength(0);
    });

    test('no peta quan no hi ha DOM', () => {
        delete global.document;
        delete global.window;

        const senseDom = new Notifier(logger);
        expect(senseDom.error('cap DOM')).toBeNull();
    });
});
