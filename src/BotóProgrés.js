/**
 * Bloqueja un botó mentre s'executa una operació llarga i n'informa el progrés.
 *
 * Evita la reentrada (doble clic), desactiva el botó mentre corre i sempre
 * restaura l'estat original, tant si l'operació va bé com si peta.
 */
export class BotóProgrés {
    /**
     * @param {HTMLButtonElement} botó
     * @param {() => string} [textInactiu] Text a restaurar en acabar. Per defecte, el que tenia.
     */
    constructor(botó, textInactiu = null) {
        this.botó = botó;
        this.textInactiu = textInactiu;
        this.ocupat = false;
    }

    /**
     * Executa la tasca amb el botó bloquejat. Si ja n'hi ha una en curs, no fa res.
     * @param {string} textOcupat Estat visible mentre corre, sense percentatges inventats.
     * @param {(informaProgrés: (actual: number, total: number) => void) => Promise<any>} tasca
     * @returns {Promise<void>}
     */
    async executa(textOcupat, tasca) {
        if (this.ocupat) return;
        this.ocupat = true;

        const textOriginal = this.botó.textContent;
        this.botó.disabled = true;
        this.botó.textContent = textOcupat;

        try {
            await tasca((actual, total) => {
                this.botó.textContent = Number.isFinite(total) && total > 0
                    ? `${textOcupat} ${actual}/${total}`
                    : textOcupat;
            });
        } finally {
            this.ocupat = false;
            this.botó.disabled = false;
            this.botó.textContent = this.textInactiu ? this.textInactiu() : textOriginal;
        }
    }
}
