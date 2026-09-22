import test from 'node:test';
import assert from 'node:assert/strict';
import {newPasswordError} from '../src/lib/password-policy.ts';
test('approved new-password policy accepts Korean and does not require mixed character classes',()=>{
 for(const value of ['가나다라마바사아','abcdefgh','12345678']) assert.equal(newPasswordError(value),null);
 assert.ok(newPasswordError('가나다라마바사'));
});
test('whitespace is rejected without trimming or changing pasted input',()=>{
 for(const gap of [' ','\t','\n','\u00a0','\u3000']) assert.ok(newPasswordError('abcd'+gap+'efgh'));
 const value=' abcdefgh ';newPasswordError(value);assert.equal(value,' abcdefgh ');
});
