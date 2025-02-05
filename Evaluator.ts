import { construct_simple_generic_procedure } from "generic-handler/GenericProcedure"
import { SchemeType,  SchemeElement, is_self_evaluating, schemeSymbol, is_true, schemeNumber, schemeClosure, isSchemeList, schemeBoolean } from "./definition/SchemeElement"
import { define_generic_matcher, define_logged_generic_matcher } from "./tools/ExpressionHandler"
import { define, lookup, type DefaultEnvironment } from "./definition/Environment"
import {P, match} from "pmatcher/MatchBuilder"
import { isSucceed } from "pmatcher/Predicates"
import { apply as apply_matched} from "pmatcher/MatchResult/MatchGenericProcs"
import { apply as apply_interp } from "./apply"
import { schemeList } from "./definition/SchemeElement"
import { make_matcher } from "./tools/GenericWrapper"
import { is_scheme_symbol } from "./definition/SchemeElement"
import { Closure } from "./definition/Closure"
import { first, rest } from "pmatcher/GenericArray"
import { isEmpty as is_empty, get_length, isPair as is_pair } from "pmatcher/GenericArray"
import { set } from "./definition/Environment"
import { will_define } from "pmatcher/MatchDict/DictValue"

// TODO: Support Currying
export type EvalHandler = (exec: (...args: any[]) => any, env: DefaultEnvironment, continuation: (result: SchemeElement, env: DefaultEnvironment) => SchemeElement) => any;

export const evaluate = construct_simple_generic_procedure("evaluate", 3, (expr, env, continuation) => {
    return default_eval(expr, env, continuation)
})

export function is_continuation(any: any): boolean{
    return any instanceof Function
}

const match_application = make_matcher([P.begin, [P.wildcard, P.wildcard, "..."], 
                                                 [[P.element, "operator"], [P.segment, "operands"]]])


function default_eval(expression: SchemeElement, env: DefaultEnvironment, continuation: (result: SchemeElement, env: DefaultEnvironment) => SchemeElement): SchemeElement{
    const application = match_application(expression)

    if (isSucceed(application)){
        return apply_matched((operator: SchemeElement, operands: SchemeElement[]) => {
            return apply_interp(continuation(operator, env), operands, env, continuation)
        }, application)
    }
    else{
        throw Error("unknown expression type" + expression.toString() + "in environment" + env.toString())
    }   
}

function make_application(operator: SchemeElement, operands: SchemeElement[]): SchemeElement{
    return schemeList([operator, ...operands])
}


const self_evaluating_expr = [P.element, "expr", is_self_evaluating]

define_generic_matcher(evaluate, self_evaluating_expr, 
    ((exec, env, continuation): EvalHandler => {
        return exec((expr: SchemeElement) => {
            return expr;
        });
    }) as EvalHandler
)


const var_expr = [P.element, "expr", is_scheme_symbol]   

define_generic_matcher(evaluate,
    var_expr,
    ((exec, env, continuation): EvalHandler => {
        return exec((expr: SchemeElement) => {
            const v = lookup(expr, env)
        
            if (v !== undefined && v !== null){
                return v
            }
            else{
                throw Error("unknown variable: " + v + "\n" +
                        "in environment: " + env.summarize() + "\n" +
                        "of symbol: " + expr.toString())
            }
        });
    }) as EvalHandler
)

const quoted_expr = ["quote", [P.element, "expr"]]

define_generic_matcher(evaluate, quoted_expr, ((exec, env, continuation): EvalHandler => {
    return exec((expr: SchemeElement) => {
        return expr
    });
}) as EvalHandler)


const if_expr = ["if", [P.element, "predicate"],  
                         [P.element, "consequent"], 
                         [P.element, "alternative"]]

function make_if(predicate: SchemeElement, consequent: SchemeElement, alternative: SchemeElement): SchemeElement{
    return schemeList([schemeSymbol("if"), predicate, consequent, alternative])
}

define_generic_matcher(evaluate, if_expr, ((exec, env, continuation): EvalHandler => {
    return exec((predicate: SchemeElement, consequent: SchemeElement, alternative: SchemeElement) => {
        if (is_true(continuation(predicate, env))){
            return continuation(consequent, env)
        }
        else{
            return continuation(alternative, env)
        }
    });
}) as EvalHandler)


const lambda_expr = ["lambda", [[P.segment_independently, "parameters"]], [P.segment, "body"]]

define_generic_matcher(evaluate, lambda_expr, ((exec, env, continuation): EvalHandler => {
    return exec((parameters: SchemeElement[], body: SchemeElement[]) => {
        return   schemeClosure(parameters, seq_to_begin(body), env)
    });
}) as EvalHandler)

function make_lambda(parameters: SchemeElement[], body: SchemeElement[]): SchemeElement{

    return schemeList([schemeSymbol("lambda"), schemeList(parameters), seq_to_begin(body)])
}

function seq_to_begin(seq: SchemeElement[]): SchemeElement{
    
    const already_begin = make_matcher(begin_expr)(seq)
    if (isSucceed(already_begin)){
        return already_begin
    }
    else if (get_length(seq) === 1){
        return first(seq)
    }
    else{
        return schemeList([schemeSymbol("begin"), ...seq])
    }
}


const begin_expr = ["begin", [P.segment, "actions"]]

define_generic_matcher(evaluate, begin_expr, ((exec, env, continuation): EvalHandler => {
    return exec((actions: SchemeElement[]) => {
        return continuation_sequence(actions, env, continuation)
    });
}) as EvalHandler)

function continuation_sequence(actions: SchemeElement[], env: DefaultEnvironment, continuation: (result: SchemeElement, env: DefaultEnvironment) => SchemeElement): SchemeElement{
    if (is_empty(actions)){
        throw Error("empty sequence in evaluate_sequence")
    }
    else if (get_length(actions) === 1){
        return continuation(first(actions), env)
    }
    else{
        continuation(first(actions), env)
        return continuation_sequence(rest(actions), env, continuation)
    }
}


const cond_expr = ["cond", [[P.many, [[P.element, "predicates"], [P.element, "consequents"]]]]]

define_generic_matcher(evaluate, cond_expr, 
    ((exec, env, continuation): EvalHandler => {
    return exec((predicates: SchemeElement[], consequents: SchemeElement[]) => {
        return continuation(cond_to_if(predicates, consequents), env)
    });
}) as EvalHandler)

function cond_to_if(predicates: SchemeElement[], consequents: SchemeElement[]): SchemeElement{
    function expand(predicates: SchemeElement[], consequents: SchemeElement[]): SchemeElement{
        if (is_empty(predicates)){
            throw Error("empty predicates in cond_to_if")
        }
        else if (get_length(predicates) === 1){
            if (first(predicates).value === schemeSymbol("else").value){
                return first(consequents)
            }
            else{
                throw Error("no else in cond_to_if, " + first(predicates).toString())
            }
        }
        else{
            return make_if(first(predicates), first(consequents), expand(rest(predicates), rest(consequents)))
        }
    }
    return expand(predicates, consequents)
}


const let_expr = ["let", [[P.many, [[P.element, "names"], [P.element, "values"]]]], [P.segment, "body"]]

define_generic_matcher(evaluate, let_expr, ((exec, env, continuation): EvalHandler => {
    return exec((names: SchemeElement[], values: SchemeElement[], body: SchemeElement[]) => {
        return continuation(let_to_combination(names, values, body), env);
    });
}) as EvalHandler);

function let_to_combination(names: SchemeElement[], values: SchemeElement[], body: SchemeElement[]): SchemeElement{
    return make_application(make_lambda(names, body), values)
}

const assignment_expr = ["set!", [P.element, "name", is_scheme_symbol], [P.element, "value"]]

define_generic_matcher(evaluate, assignment_expr, ((exec, env, continuation): EvalHandler => {
    return exec((name: SchemeElement, value: SchemeElement) => {
       return set(name, continuation(value, env), env)
    });
}) as EvalHandler);


export const define_expr =  [P.new, ["parameters"], 
                                [P.choose,
                                    ["define", [[P.element, "name", is_scheme_symbol], [P.segment, "parameters"]], [P.segment, "body"]],
                                    ["define", [P.element, "name", is_scheme_symbol], [P.segment, "body"]],
                                    ]]
define_generic_matcher(evaluate, define_expr, ((exec, env, continuation): EvalHandler => {
    return exec((name: SchemeElement, parameters: SchemeElement[] | string, body: SchemeElement[]) => {
        if (parameters === will_define){
            return define(name, continuation(seq_to_begin(body), env), env)
        }
        else{
            // @ts-ignore
            return define(name, continuation(make_lambda(parameters, body), env), env)
        }
    });
}) as EvalHandler);



export const car_expr = ["car", [P.element, "pair"]]

define_generic_matcher(evaluate, car_expr, ((exec, env, continuation): EvalHandler => {
    return exec((pair: SchemeElement) => {
       if (pair.value.length > 0){
        const fst = first(evaluate(pair, env, continuation).value)
        return evaluate(fst, env, continuation)
       }
       else{
        throw Error("car: pair must have at least one element")
       }
    });
}) as EvalHandler)

export const cdr_expr = ["cdr", [P.element, "pair"]]    

define_generic_matcher(evaluate, cdr_expr, ((exec, env, continuation): EvalHandler => {
    return exec((pair: SchemeElement) => {
       if (pair.value.length > 0){
        return schemeList(rest(evaluate(pair, env, continuation).value))
       }
       else{
        throw Error("cdr: pair must have at least one element")
       }
    });
}) as EvalHandler)

export const cons_expr = ["cons", [P.element, "a"], [P.element, "b"]]

define_generic_matcher(evaluate, cons_expr, ((exec, env, continuation): EvalHandler => {
    return exec((a: SchemeElement, b: SchemeElement) => {
        if (isSchemeList(b)){
            return schemeList([a, ...b.value])
        }
        else if (is_self_evaluating(b)){
            // console.log(b)
            return schemeList([a, b])
        }
        else{
            throw Error("cons: second argument must be a list or a self-evaluating element")
        }
    });
}) as EvalHandler)

export const is_null_expr = ["null?", [P.element, "pair"]]

define_generic_matcher(evaluate, is_null_expr, ((exec, env, continuation): EvalHandler => {
    return exec((pair: SchemeElement) => {
        const result = evaluate(pair, env, continuation)
        if (isSchemeList(result)){
            return schemeBoolean(is_empty(result.value))
        }
        else{
            throw Error("null?: pair must be a list")
        }
    });
}) as EvalHandler)


export const list_expr = ["list", [P.segment, "elements"]]

define_generic_matcher(evaluate, list_expr, ((exec, env, continuation): EvalHandler => {
    return exec((elements: SchemeElement[]) => {
        return schemeList(elements.map((element) => evaluate(element, env, continuation)))
    });
}) as EvalHandler)

// const test_array = new SchemeElement([schemeNumber(1), new schemeList([schemeSymbol("lambda"), schemeNumber(2), schemeSymbol("3")])], SchemeType.List);
// const test_result = match(test_array, [[P.element, "a"], ["lambda", [P.element, "b"], "3"]]);
// console.log(inspect(test_result, {  depth: 20 }));