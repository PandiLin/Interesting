import {  compile,  run_matcher, first_equal_with, P, try_match} from "pmatcher/MatchBuilder";
import {  type matcher_instance } from "pmatcher/MatchCallback";
import { is_match_key, type MatchDict } from "pmatcher/MatchDict/MatchDict";
import { construct_simple_generic_procedure } from "generic-handler/GenericProcedure";
import type { MatchEnvironment } from "pmatcher/MatchEnvironment";
import { define_generic_procedure_handler } from "generic-handler/GenericProcedure";
import { first, isArray } from "pmatcher/GenericArray";
import { inspect } from "bun";
import 'ts-array-extensions'
import { v4 as uuidv4} from 'uuid';
import { isString } from "effect/Predicate";
import { match_constant } from "pmatcher/MatchCombinator";
import { equal } from "pmatcher/utility";
import { SchemeElement, isSchemeStr } from "../definition/SchemeElement";
// const ExprStore = new Map<string[], (...args: any[]) => any>();
import { match_args } from "generic-handler/Predicates";
import { GenericProcedureMetadata } from "generic-handler/GenericProcedureMetadata";
import { SimpleDispatchStore } from "generic-handler/DispatchStore";
// import type { MatchResult } from "./MatcherWrapper";
import type { MatchPartialSuccess } from "pmatcher/MatchResult/PartialSuccess";
import { match } from "pmatcher/MatchBuilder"
import { isSucceed } from "pmatcher/Predicates";
import { MatchResult } from "pmatcher/MatchResult/MatchResult";
import { get_input_modifiers, get_output_modifier } from "./Advice";

// // console.log(compile_to_matcher(["test", [E.arg, "a"], [[[E.arg, "b"], [E.arg, "c"]], "..."], [[E.arg, "c"], [E.arg, "d"]]]))


// // TODO: adapt our short expression language to matcher language in the evaluator
type evaluator = (expr: any[], 
    env: MatchEnvironment, 
    continuation: (expr: any[], env: MatchEnvironment) => any) => any


define_generic_procedure_handler(
    equal, 
    match_args(isString, isSchemeStr), 
    (a: string, b: SchemeElement) => {
        return a === b.value
    }
)


function define_generic_matcher(proc: (... args: any) => any, matcher_expr: any[], handler: (...args: any[]) => any, specified_advices: any[] = []){
    var matchResult: MatchResult | null = null


    const input_modifiers = specified_advices.map(get_input_modifiers)
    const output_modifiers = specified_advices.map(get_output_modifier)


    return define_generic_procedure_handler(proc,
        (input: any[], ...args: any[]) => {
            const processed_matcher_expr = input_modifiers.reduce((acc, advice) => {
                const input_modifier = first(advice)
                return input_modifier(acc)
            }, matcher_expr)
            matchResult = match(input, processed_matcher_expr)
            if (isSucceed(matchResult)){
                return true
            }
            else{
                return false
            }
        },
        (input: any[], ...args: any[]) => {
            if (matchResult !== null){
                const processed_output = output_modifiers.reduce((acc, advice) => {
                    const output_modifier = advice
                    return output_modifier(acc)
                }, matchResult)
                return handler(processed_output, ...args)
            }
            else{
                throw new Error("MatchResult is null")
            }
        
    })
}

const test_eval = construct_simple_generic_procedure("test_eval", 2, (...args: any[]) => {
    return args[0] + args[1]
})

define_generic_matcher(test_eval, [[P.element, "a"], "b"], (result: MatchResult, other: number) => {
    console.log(inspect(result))
    console.log(other)
})

test_eval([1, "b"], 2)