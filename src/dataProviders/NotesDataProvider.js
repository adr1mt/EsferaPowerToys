import { NotesMapper } from './NotesMapper.js';
import { Notifier } from '../Notifier.js';

/**
 * Obté les dades de notes exposades pels serveis Angular d'Esfer@.
 */
export class NotesDataProvider {
    /**
     * @param {import('../PowerToysLogger.js').PowerToysLogger} logger
     * @param {NotesMapper} mapper
     * @param {Notifier} notifier
     */
    constructor(logger, mapper = new NotesMapper(), notifier = new Notifier(logger)) {
        this.logger = logger;
        this.mapper = mapper;
        this.notifier = notifier;
    }

    /**
     * Obté totes les dades necessàries per exportar o visualitzar les notes del grup actual.
     * @param {(actual: number, total: number) => void} [informaProgrés] Rep quants alumnes s'han carregat.
     * @returns {Promise<{notesAlumnes: Array<Object>, nomGrup: string, incidències: Array<Object>}|null>}
     */
    async obtéDadesExportació(informaProgrés = () => {}) {
        const idGrup = this.extractIdGrup();
        if (idGrup === null) {
            this.notifier.error(
                "No s'ha pogut identificar el grup a partir de l'adreça. Obre la pàgina del grup des d'Esfer@ i torna-ho a provar.",
            );
            return null;
        }

        const injector = this.obtéInjectorAngular();
        if (!injector) {
            this.notifier.error(
                "Esfer@ encara no ha acabat de carregar-se. Espera que la pàgina estigui llesta i torna-ho a provar.",
            );
            return null;
        }

        const factory = this.obtéAvaluacioFactory(injector);

        var matricules = await this.extractIdMatricula(factory, idGrup, injector);

        if (!matricules || matricules.length === 0) {
            this.notifier.error("No s'ha pogut obtenir la llista d'alumnes del grup.");
            return null;
        }

        const total = matricules.length;
        informaProgrés(0, total);

        const tasks = matricules.map((alumne, idx) => async () => {
            const resultat = await this.obtéDadesAlumne(factory, alumne, idx, total, idGrup);
            informaProgrés(idx + 1, total);
            return resultat;
        });
        const notesAlumnes = await this.executeQueue(tasks, {
            concurrency: 1,
            limit: Infinity,
            interval: 500,
        });

        return {
            notesAlumnes,
            nomGrup: matricules[0].nomGrup,
            incidències: this.recullIncidències(notesAlumnes),
        };
    }

    /**
     * Obté l'injector Angular de la pàgina d'Esfer@ si està disponible.
     */
    obtéInjectorAngular() {
        const element = document.documentElement;
        return window.angular ? window.angular.element(element).injector() : null;
    }

    /**
     * Obté la factoria d'avaluació corresponent (parcial o final).
     * @param {Object} [injector]
     * @returns {Object|null}
     */
    obtéAvaluacioFactory(injector = this.obtéInjectorAngular()) {
        if (!injector) return null;
        if (window.location.pathname.includes("parcialAvaluacioGrupAlumne")) {
            return injector.get('newParcialAvaluacioGrupAlumneFactory');
        }
        return injector.get('newFinalAvaluacioGrupAlumneFactory');
    }

    /**
     * Obté el número màxim d'avaluacions disponibles per a un grup i ho guarda en memòria cau.
     *
     * Si no es pot determinar retorna `null`: no se n'inventa cap valor per defecte.
     * @returns {Promise<number|null>}
     */
    async obtéMaxAvaluacions() {
        const idGrup = this.extractIdGrup();
        if (!idGrup) return this.avisaMaxAvaluacionsDesconegut();

        const isParcial = window.location.pathname.includes("parcialAvaluacioGrupAlumne");
        const type = isParcial ? 'parcial' : 'final';
        const cacheKey = `powertoys_max_avaluacions_${type}_${idGrup}`;

        const cached = localStorage.getItem(cacheKey);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (now - parsed.timestamp < oneHour) {
                    return parsed.maxAvaluacions;
                }
            } catch (e) {
                this.logger.warn('Error parsejant cache de maxAvaluacions', e);
            }
        }

        try {
            const injector = this.obtéInjectorAngular();
            if (!injector) return this.avisaMaxAvaluacionsDesconegut();

            const factory = this.obtéAvaluacioFactory(injector);

            const matricules = await this.extractIdMatricula(factory, idGrup, injector);
            if (!matricules || matricules.length === 0) return this.avisaMaxAvaluacionsDesconegut();

            const primerAlumne = matricules[0];
            const data = await this.fetchAvaluacioData(factory, primerAlumne.idMatricula, idGrup);

            if (data && data.lAvaluacions && Array.isArray(data.lAvaluacions)) {
                const maxAvaluacions = data.lAvaluacions.length;
                localStorage.setItem(cacheKey, JSON.stringify({ maxAvaluacions, timestamp: now }));
                this.logger.log(`NotesDataProvider → maxAvaluacions actualitzat a ${maxAvaluacions} per a ${type} (grup ${idGrup})`);
                return maxAvaluacions;
            }
        } catch (error) {
            this.logger.error('NotesDataProvider → Error obtenint maxAvaluacions:', error);
        }

        return this.avisaMaxAvaluacionsDesconegut();
    }

    /**
     * Comunica que el nombre d'avaluacions és desconegut i atura la funcionalitat.
     * @returns {null}
     */
    avisaMaxAvaluacionsDesconegut() {
        this.notifier.error(
            "No s'ha pogut determinar el nombre d'avaluacions del grup. Recarrega la pàgina del grup a Esfer@ i torna-ho a provar.",
        );
        return null;
    }

    /**
     * Obté les dades d'avaluació d'un alumne i les normalitza al model intern.
     */
    async obtéDadesAlumne(factory, alumne, idx, total, idGrup) {
        const idMat = alumne.idMatricula;

        if (!idMat || !idGrup) {
            this.logger.warn(`NotesDataProvider → Alumne ${alumne.nomComplet} sense IDs → saltant`);
            return { skipped: true, nom: alumne.nomComplet };
        }

        try {
            this.logger.log(`NotesDataProvider → ⏳ [${idx + 1}/${total}] Carregant ${alumne.nomComplet}...`);

            const dadesAlumne = await this.fetchAvaluacioData(factory, idMat, idGrup);

            if (!dadesAlumne || !dadesAlumne.lContinguts) {
                this.logger.warn(`NotesDataProvider → No s'han rebut dades per ${alumne.nomComplet}`);
                return { skipped: true, nom: alumne.nomComplet };
            }

            return this.mapper.normalitzaAlumne(alumne, dadesAlumne);
        } catch (err) {
            this.logger.error(`NotesDataProvider → Error amb ${alumne.nomComplet}:`, err);
            return { error: true, nom: alumne.nomComplet, err };
        }
    }

    /**
     * @param {Object} factory
     * @param {number} idGrup
     * @param {Object} injector
     * @returns {Promise<Array|null>}
     */
    extractIdMatricula(factory, idGrup, injector = this.obtéInjectorAngular()) {
        this.logger.log('NotesDataProvider → inici idMatricula');

        if (!injector) {
            this.logger.error('NotesDataProvider → Injector Angular no disponible');
            return Promise.resolve(null);
        }

        let factoryGrup;
        if (window.location.pathname.includes("parcialAvaluacioGrupAlumne")) {
            factoryGrup = injector.get('parcialavaluaciogrupalumneFactory'); 
        } else {
            factoryGrup = injector.get('finalavaluaciogrupalumneFactory');
        }

        return factoryGrup.getGrupClasseById(idGrup)
            .then((resGrup) => {
                const fkGrup = resGrup.data.fkGrup;
                return factory.getAlumnesGrupById(fkGrup);
            })
            .then((resAlumnes) => resAlumnes.data.matriculesGrupDTOList)
            .catch((err) => {
                this.logger.error('NotesDataProvider → Error obtenint el grup:', err);
                return null;
            });
    }

    /**
     * @returns {number|null}
     */
    extractIdGrup() {
        const urlGrup = new URL(window.location.href).href;
        const grup = urlGrup.replace(/\/+$/, '').split('/').pop().match(/\d+/);
        return grup ? parseInt(grup[0], 10) : null;
    }

    /**
     * @param {Object} factory
     * @param {string|number} idMat
     * @param {number} idGrup
     * @returns {Promise<object>}
     */
    async fetchAvaluacioData(factory, idMat, idGrup) {

        const isParcial = window.location.href.includes('parcialAvaluacioGrupAlumne');
        const methodName = isParcial 
        ? 'obtenirDadesGrupIAlumneParcial' 
        : 'obtenirDadesGrupIAlumneFinal';


        return factory[methodName](idMat, idGrup)
        .then(function (res) {

            const wrapperKey = isParcial 
            ? 'avaluacioGrupIAlumneParcialNormWrapper'
            : 'avaluacioGrupIAlumneWrapper';
            
            return res.data[wrapperKey];
        })
        .catch((err) => {
            this.logger.error(`NotesDataProvider → ERROR EN LA PETICIÓ (${isParcial ? 'PARCIAL' : 'FINAL'}):`, err);
            throw err;
        });
    }

    /**
     * Recull els alumnes que no s'han pogut carregar perquè es puguin comunicar.
     * @param {Array<Object>} notesAlumnes
     * @returns {Array<{nom: string, motiu: string}>}
     */
    recullIncidències(notesAlumnes) {
        return (notesAlumnes || [])
            .filter((alumne) => !alumne || alumne.skipped || alumne.error || !alumne.success)
            .map((alumne) => ({
                nom: alumne?.nom ?? '(sense nom)',
                motiu: alumne?.error ? 'error en la petició' : 'sense dades',
            }));
    }

    /**
     * Executa peticions asíncrones controlant concurrència i interval.
     */
    async executeQueue(tasks, { concurrency = Infinity, limit = Infinity, interval = 0 } = {}) {
        const results = new Array(tasks.length);
        const queue = tasks.map((task, index) => ({ task, index }));

        let activeCount = 0;
        let launchedInInterval = 0;
        let lastIntervalStart = Date.now();

        return new Promise((resolve) => {
            const next = async () => {
                if (queue.length === 0 && activeCount === 0) {
                    return resolve(results);
                }

                const now = Date.now();

                if (interval > 0 && now - lastIntervalStart >= interval) {
                    launchedInInterval = 0;
                    lastIntervalStart = now;
                }

                while (queue.length > 0) {
                    if (activeCount >= concurrency) break;

                    if (interval > 0 && launchedInInterval >= limit) {
                        const delay = interval - (Date.now() - lastIntervalStart);
                        setTimeout(next, Math.max(0, delay));
                        return;
                    }

                    const { task, index } = queue.shift();

                    activeCount++;
                    launchedInInterval++;

                    (async (i) => {
                        try {
                            results[i] = await task();
                        } catch (err) {
                            results[i] = { error: true, err };
                        } finally {
                            activeCount--;
                            next();
                        }
                    })(index);
                }
            };
            next();
        });
    }
}
