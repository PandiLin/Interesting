import { v4 as uuidv4 } from 'uuid';
import { Cell } from './Cell';
import { make_relation, Relation } from './Relation';
import type { Propagator } from './Propagator';
import { construct_simple_generic_procedure } from 'generic-handler/GenericProcedure';
import { make_layered_procedure } from '../LayerSystem/Layer';
import { merge } from './Merge';
export class PublicState{
    parent: Relation = make_relation("root", null);
    allCells: Cell[] = [];
    allPropagators: Propagator[] = [];

    addCell(cell: Cell){
        this.allCells.push(cell);
    }

    addChild(child: Relation){
        this.parent.addChild(child);
    }
}

export function add_global_cell(cell: Cell){
    public_state.addCell(cell);
} 

export function add_global_propagator(propagator: Propagator){
    public_state.allPropagators.push(propagator);
}

export function add_global_child(relation: Relation){
    public_state.addChild(relation);
}

export function get_global_parent(){
    return public_state.parent;
}

export function set_global_parent(relation: Relation){
    public_state.parent = relation;
}

export const public_state = new PublicState();

export const get_all_cells = (): Cell[] => {
    return public_state.allCells;
}


export const is_equal = construct_simple_generic_procedure("is_equal", 2,
    (a: any, b: any) => {
        return a === b;
    }
)


export const is_unusable_value = construct_simple_generic_procedure("is_unusable_value", 1,
    (value: any) => {
        return false;
    }
)

export const value_imples = construct_simple_generic_procedure("value_imples", 2,
    (a: any, b: any) => {
        return a === b;
    }
)

export const merge_layered = make_layered_procedure("merge_layered", 2, merge)

