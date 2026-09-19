/**
 * Mostra missatges visibles a la persona usuària perquè cap error mori en silenci.
 *
 * Els errors i els avisos es mantenen fins que es tanquen manualment; la informació
 * desapareix sola. Els missatges repetits no es dupliquen.
 */
export class Notifier {
    /** Mil·lisegons que dura un missatge informatiu abans d'amagar-se. */
    static DURADA_INFO = 6000;

    /**
     * @param {import('./PowerToysLogger.js').PowerToysLogger} logger
     */
    constructor(logger) {
        this.logger = logger;
        this.contenidor = null;
    }

    /**
     * Missatge informatiu. Desapareix sol.
     * @param {string} missatge
     * @returns {HTMLElement|null}
     */
    info(missatge) {
        return this.mostra('info', missatge, Notifier.DURADA_INFO);
    }

    /**
     * Avís: alguna cosa no ha anat com tocava però l'operació continua.
     * @param {string} missatge
     * @returns {HTMLElement|null}
     */
    warn(missatge) {
        this.logger.warn(`Notifier → ${missatge}`);
        return this.mostra('warn', missatge, null);
    }

    /**
     * Error: l'operació no s'ha pogut completar.
     * @param {string} missatge
     * @param {Error} [causa] Error original, només per al registre tècnic.
     * @returns {HTMLElement|null}
     */
    error(missatge, causa = null) {
        this.logger.error(`Notifier → ${missatge}`, causa ?? '');
        return this.mostra('error', missatge, null);
    }

    /**
     * Demana confirmació explícita abans de continuar amb dades incompletes.
     *
     * Sense confirmació l'operació s'atura: mai es generen dades parcials automàticament.
     * @param {Array<{nom: string, motiu: string}>} incidències
     * @param {string} context Descripció curta de l'operació afectada.
     * @returns {boolean} Cert si es pot continuar.
     */
    confirmaIncidències(incidències, context) {
        if (!Array.isArray(incidències) || incidències.length === 0) return true;

        const noms = incidències.map((incidència) => incidència.nom || '(sense nom)').join(', ');
        const resum = `${context}: no s'han pogut carregar ${incidències.length} alumnes (${noms}).`;

        if (this.demanaConfirmació(`${resum}\n\nLes dades serien incompletes. Vols continuar igualment?`)) {
            this.warn(`${resum} Has triat continuar amb dades incompletes.`);
            return true;
        }

        this.error(`${resum} L'operació s'ha aturat per no generar dades incompletes.`);
        return false;
    }

    /**
     * Pregunta a la persona usuària. Aïllat per poder-lo substituir als tests.
     * @param {string} missatge
     * @returns {boolean}
     */
    demanaConfirmació(missatge) {
        if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
        return window.confirm(missatge);
    }

    /**
     * Crea i mostra un missatge, evitant duplicats idèntics.
     * @param {'info'|'warn'|'error'} tipus
     * @param {string} missatge
     * @param {number|null} durada Mil·lisegons fins a amagar-lo, o null per mantenir-lo.
     * @returns {HTMLElement|null}
     */
    mostra(tipus, missatge, durada) {
        const contenidor = this.obtéContenidor();
        if (!contenidor) return null;

        const existent = this.cercaDuplicat(contenidor, tipus, missatge);
        if (existent) return existent;

        const avís = document.createElement('div');
        avís.className = `powertoy-notice powertoy-notice--${tipus}`;
        avís.setAttribute('role', tipus === 'error' ? 'alert' : 'status');
        avís.dataset.tipus = tipus;

        const text = document.createElement('span');
        text.className = 'powertoy-notice-text';
        text.textContent = missatge;
        avís.appendChild(text);

        const tanca = document.createElement('button');
        tanca.type = 'button';
        tanca.className = 'powertoy-notice-close';
        tanca.textContent = '×';
        tanca.setAttribute('aria-label', 'Tanca el missatge');
        tanca.addEventListener('click', () => avís.remove());
        avís.appendChild(tanca);

        contenidor.appendChild(avís);

        if (durada) setTimeout(() => avís.remove(), durada);

        return avís;
    }

    /**
     * Cerca un missatge idèntic ja visible per no duplicar-lo.
     * @param {HTMLElement} contenidor
     * @param {string} tipus
     * @param {string} missatge
     * @returns {HTMLElement|null}
     */
    cercaDuplicat(contenidor, tipus, missatge) {
        return Array.from(contenidor.children).find((fill) => (
            fill.dataset?.tipus === tipus
            && fill.querySelector('.powertoy-notice-text')?.textContent === missatge
        )) ?? null;
    }

    /**
     * Treu tots els missatges visibles.
     * @returns {void}
     */
    neteja() {
        if (this.contenidor) this.contenidor.textContent = '';
    }

    /**
     * Obté el contenidor fix de missatges, creant-lo i injectant-ne els estils si cal.
     * @returns {HTMLElement|null}
     */
    obtéContenidor() {
        if (this.contenidor?.isConnected) return this.contenidor;
        if (typeof document === 'undefined' || !document.body) return null;

        this.injectaEstils();
        this.contenidor = document.createElement('div');
        this.contenidor.id = 'powertoy-notices';
        this.contenidor.className = 'powertoy-notices';
        document.body.appendChild(this.contenidor);
        return this.contenidor;
    }

    /**
     * Injecta els estils una sola vegada.
     * @returns {void}
     */
    injectaEstils() {
        if (document.getElementById('powertoy-notice-styles')) return;

        const style = document.createElement('style');
        style.id = 'powertoy-notice-styles';
        style.textContent = `
            .powertoy-notices {
                position: fixed;
                top: 12px;
                right: 12px;
                z-index: 2147483646;
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-width: min(420px, calc(100vw - 24px));
            }

            .powertoy-notice {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 12px 14px;
                border-radius: 6px;
                border-left: 5px solid;
                background: #fff;
                box-shadow: 0 2px 10px rgba(0, 0, 0, .25);
                font-size: 14px;
                line-height: 1.45;
                color: #222;
            }

            .powertoy-notice--error { border-left-color: #c0392b; background: #fdecea; }
            .powertoy-notice--warn { border-left-color: #d68910; background: #fef5e7; }
            .powertoy-notice--info { border-left-color: #2471a3; background: #eaf2f8; }

            .powertoy-notice-text { flex: 1; overflow-wrap: anywhere; }

            .powertoy-notice-close {
                flex: 0 0 auto;
                background: transparent;
                border: none;
                font-size: 20px;
                line-height: 1;
                cursor: pointer;
                color: inherit;
                padding: 0 2px;
            }

            .powertoy-notice-close:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
        `;
        document.head.appendChild(style);
    }
}
