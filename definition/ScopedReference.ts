import { summarize_dict } from "../tools/utility"

var referenceCount = 0

export function clear_scope_history(){
    referenceCount = 0
}


export type ScopeReference = number

export function default_ref(): ScopeReference{
    return 0
}

export function new_ref(): ScopeReference{
    referenceCount = referenceCount + 1
    return referenceCount
}

export function is_scope_reference(A: any): boolean{
    return typeof A === "number"
}

export type scoped_value = Map<ScopeReference, any>

export function create_dict_value(value: any, scope: ScopeReference): scoped_value{
    const dict = new Map()
    return set_scoped_value(dict, scope, value)
}

export function lookup_scoped_value(dict: scoped_value, scope: ScopeReference): any{
    return dict.get(scope)
} 

export function set_scoped_value(dict: scoped_value, scope: ScopeReference, value: any): scoped_value{
    dict.set(scope, value)
    return dict
}

export function get_largest_scope(dict: scoped_value): ScopeReference{
    return Math.max(...dict.keys())
}

export function get_value_in_scope(dict: scoped_value, scope: ScopeReference): any{
    return dict.get(scope)
}

export function get_value_in_largest_scope(dict: scoped_value): any{
    return get_value_in_scope(dict, get_largest_scope(dict))
}


export function has_scope(dict: scoped_value, scope: ScopeReference): boolean{
    return dict.has(scope)
}

export function scope_not_exist_before(dict: scoped_value, scope: ScopeReference): boolean{
    return !has_scope(dict, scope)
}

export function summarize_scoped_value(dict: scoped_value): string{
    return summarize_dict(dict, (value: any) => value.toString())
}