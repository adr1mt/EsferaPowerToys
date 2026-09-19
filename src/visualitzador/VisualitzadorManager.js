import { NotesAggregationHelper } from '../dataProviders/NotesAggregationHelper.js';
import { Notifier } from '../Notifier.js';

/**
 * Coordina l'obtenció de dades i l'obertura del visualitzador.
 */
export class VisualitzadorManager {
    constructor(
        logger,
        dataProvider,
        modelBuilder,
        modal,
        notesAggregationHelper = new NotesAggregationHelper(),
        notifier = new Notifier(logger),
    ) {
        this.logger = logger;
        this.dataProvider = dataProvider;
        this.modelBuilder = modelBuilder;
        this.modal = modal;
        this.notesAggregationHelper = notesAggregationHelper;
        this.notifier = notifier;
    }

    /**
     * Carrega les dades directament d'Esfer@ i obre el modal.
     * @param {number|typeof NotesAggregationHelper.MODE_AGREGAT} evaluation
     */
    async obreVisualitzador(evaluation = 1) {
        this.logger.log('VisualitzadorManager → obreVisualitzador inici');

        try {
            const dadesExportació = await this.dataProvider.obtéDadesExportació();
            if (!dadesExportació) return;

            this.notifier.avisaIncidències(dadesExportació.incidències, 'Visualitzador');

            const isAgregat = this.notesAggregationHelper.ésModeAgregació(evaluation);
            const maxAvaluacions = isAgregat ? await this.dataProvider.obtéMaxAvaluacions() : 0;
            const model = this.modelBuilder.construeixModel(
                dadesExportació.notesAlumnes,
                evaluation,
                maxAvaluacions,
            );
            this.modal.open(model.students, this.obtéTextContextVisualització(evaluation, isAgregat));
        } catch (error) {
            this.notifier.error(`No s'ha pogut obrir el visualitzador: ${error.message}`, error);
        }
    }

    /**
     * Obté el text contextual que indica quines dades s'estan visualitzant.
     */
    obtéTextContextVisualització(evaluation, isAgregat) {
        return isAgregat
            ? 'Visualitzant: Totes les avaluacions (agregat)'
            : 'Visualitzant: Avaluació ' + evaluation;
    }
}
