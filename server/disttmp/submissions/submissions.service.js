"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionsService = void 0;
// src/submissions/submissions.service.ts
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var SubmissionsService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var SubmissionsService = _classThis = /** @class */ (function () {
        function SubmissionsService_1(prisma) {
            this.prisma = prisma;
        }
        // ---- helpers -------------------------------------------------------------
        SubmissionsService_1.prototype.getActiveMembership = function (user) {
            return __awaiter(this, void 0, void 0, function () {
                var m_1, m_2, m;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!user.membershipId) return [3 /*break*/, 2];
                            return [4 /*yield*/, this.prisma.membership.findUnique({
                                    where: { id: user.membershipId },
                                    select: {
                                        id: true,
                                        organizationId: true,
                                        role: true,
                                    },
                                })];
                        case 1:
                            m_1 = _a.sent();
                            if (m_1)
                                return [2 /*return*/, m_1];
                            _a.label = 2;
                        case 2:
                            if (!user.organizationId) return [3 /*break*/, 4];
                            return [4 /*yield*/, this.prisma.membership.findFirst({
                                    where: { userId: user.id, organizationId: user.organizationId },
                                    select: { id: true, organizationId: true, role: true },
                                })];
                        case 3:
                            m_2 = _a.sent();
                            if (m_2)
                                return [2 /*return*/, m_2];
                            _a.label = 4;
                        case 4: return [4 /*yield*/, this.prisma.membership.findFirst({
                                where: { userId: user.id },
                                select: { id: true, organizationId: true, role: true },
                            })];
                        case 5:
                            m = _a.sent();
                            if (!m)
                                throw new common_1.ForbiddenException('Nemáš aktivní členství v organizaci.');
                            return [2 /*return*/, m];
                    }
                });
            });
        };
        SubmissionsService_1.prototype.assertSameOrg = function (orgA, orgB) {
            if (orgA && orgB && orgA === orgB)
                return;
            throw new common_1.ForbiddenException('Cross-org access denied');
        };
        SubmissionsService_1.prototype.normalizeFitb = function (s) {
            return ((s !== null && s !== void 0 ? s : '')
                .trim()
                .normalize('NFD')
                // eslint-disable-next-line no-useless-escape
                .replace(/\p{Diacritic}/gu, '')
                .toLowerCase());
        };
        // ---- API methods ---------------------------------------------------------
        SubmissionsService_1.prototype.create = function (dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var assignment, membership, isStudent, allowed, enrolled, now, attempts;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.assignment.findUnique({
                                where: { id: dto.assignmentId },
                                include: {
                                    test: { select: { id: true, organizationId: true } },
                                    students: { select: { studentId: true } }, // AssignmentStudent[]
                                },
                            })];
                        case 1:
                            assignment = _a.sent();
                            if (!assignment)
                                throw new common_1.NotFoundException('Assignment nenalezen');
                            return [4 /*yield*/, this.getActiveMembership(user)];
                        case 2:
                            membership = _a.sent();
                            // 3) multitenancy
                            this.assertSameOrg(assignment.organizationId, membership.organizationId);
                            isStudent = String(membership.role) === 'STUDENT';
                            if (!isStudent) return [3 /*break*/, 6];
                            allowed = false;
                            if (!(assignment.targetType === 'STUDENTS')) return [3 /*break*/, 3];
                            allowed = assignment.students.some(function (s) { return s.studentId === membership.id; });
                            return [3 /*break*/, 5];
                        case 3:
                            if (!assignment.classSectionId) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.prisma.enrollment.findFirst({
                                    where: {
                                        student: { membershipId: membership.id },
                                        classSectionId: assignment.classSectionId,
                                        status: 'ACTIVE',
                                    },
                                    select: { id: true },
                                })];
                        case 4:
                            enrolled = _a.sent();
                            allowed = !!enrolled;
                            _a.label = 5;
                        case 5:
                            if (!allowed) {
                                throw new common_1.ForbiddenException('Assignment není určen pro tohoto studenta');
                            }
                            _a.label = 6;
                        case 6:
                            now = new Date();
                            if (now < assignment.openAt)
                                throw new common_1.BadRequestException('Assignment ještě není otevřen');
                            if (now > assignment.closeAt)
                                throw new common_1.BadRequestException('Assignment je uzavřen');
                            return [4 /*yield*/, this.prisma.submission.count({
                                    where: { assignmentId: assignment.id, studentId: membership.id },
                                })];
                        case 7:
                            attempts = _a.sent();
                            if (attempts >= assignment.maxAttempts) {
                                throw new common_1.BadRequestException('Vyčerpán maximální počet pokusů');
                            }
                            // 7) vytvoř submission (PENDING draft)
                            return [2 /*return*/, this.prisma.submission.create({
                                    data: {
                                        assignmentId: assignment.id,
                                        testId: assignment.testId,
                                        studentId: membership.id,
                                        attemptNo: attempts + 1,
                                        status: client_1.SubmissionStatus.PENDING,
                                    },
                                })];
                    }
                });
            });
        };
        SubmissionsService_1.prototype.updateResponses = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var submission, membership, list, test, validQuestionIds, _loop_1, this_1, _i, list_1, r;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, this.prisma.submission.findUnique({
                                where: { id: id },
                                include: {
                                    assignment: { select: { organizationId: true } },
                                    student: { select: { id: true, organizationId: true } },
                                    responses: { select: { id: true, questionId: true } },
                                },
                            })];
                        case 1:
                            submission = _c.sent();
                            if (!submission)
                                throw new common_1.NotFoundException('Submission nenalezena');
                            return [4 /*yield*/, this.getActiveMembership(user)];
                        case 2:
                            membership = _c.sent();
                            this.assertSameOrg(submission.assignment.organizationId, membership.organizationId);
                            if (submission.studentId !== membership.id) {
                                throw new common_1.ForbiddenException('Access denied');
                            }
                            if (submission.submittedAt) {
                                throw new common_1.BadRequestException('Submission je již uzavřena');
                            }
                            list = (_a = dto.responses) !== null && _a !== void 0 ? _a : [];
                            if (list.length === 0)
                                return [2 /*return*/, { success: true }];
                            return [4 /*yield*/, this.prisma.test.findUnique({
                                    where: { id: submission.testId },
                                    select: { questions: { select: { id: true } } },
                                })];
                        case 3:
                            test = _c.sent();
                            validQuestionIds = new Set(((_b = test === null || test === void 0 ? void 0 : test.questions) !== null && _b !== void 0 ? _b : []).map(function (q) { return q.id; }));
                            _loop_1 = function (r) {
                                var existing, e_1;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0:
                                            if (!validQuestionIds.has(r.questionId)) {
                                                throw new common_1.BadRequestException('Nevalidní questionId');
                                            }
                                            existing = submission.responses.find(function (x) { return x.questionId === r.questionId; });
                                            _d.label = 1;
                                        case 1:
                                            _d.trys.push([1, 6, , 7]);
                                            if (!existing) return [3 /*break*/, 3];
                                            return [4 /*yield*/, this_1.prisma.response.update({
                                                    where: { id: existing.id },
                                                    data: { givenText: r.givenText },
                                                })];
                                        case 2:
                                            _d.sent();
                                            return [3 /*break*/, 5];
                                        case 3: return [4 /*yield*/, this_1.prisma.response.create({
                                                data: {
                                                    submissionId: submission.id,
                                                    questionId: r.questionId,
                                                    givenText: r.givenText,
                                                },
                                            })];
                                        case 4:
                                            _d.sent();
                                            _d.label = 5;
                                        case 5: return [3 /*break*/, 7];
                                        case 6:
                                            e_1 = _d.sent();
                                            // Catch Prisma errors for invalid UUID or FK
                                            if (e_1.code === 'P2003' || e_1.code === 'P2023') {
                                                throw new common_1.BadRequestException('Nevalidní questionId');
                                            }
                                            throw e_1;
                                        case 7: return [2 /*return*/];
                                    }
                                });
                            };
                            this_1 = this;
                            _i = 0, list_1 = list;
                            _c.label = 4;
                        case 4:
                            if (!(_i < list_1.length)) return [3 /*break*/, 7];
                            r = list_1[_i];
                            return [5 /*yield**/, _loop_1(r)];
                        case 5:
                            _c.sent();
                            _c.label = 6;
                        case 6:
                            _i++;
                            return [3 /*break*/, 4];
                        case 7: return [2 /*return*/, { success: true }];
                    }
                });
            });
        };
        SubmissionsService_1.prototype.finish = function (id, dto, user) {
            return __awaiter(this, void 0, void 0, function () {
                var submission, membership, now, incoming, test_1, validQuestionIds, _loop_2, this_2, _i, incoming_1, r, dbResponses, total, maxScore, _loop_3, this_3, _a, _b, q, normalizedScore, finished;
                var _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0: return [4 /*yield*/, this.prisma.submission.findUnique({
                                where: { id: id },
                                include: {
                                    assignment: {
                                        select: {
                                            id: true,
                                            organizationId: true,
                                            closeAt: true,
                                            openAt: true,
                                        },
                                    },
                                    student: { select: { id: true, organizationId: true } },
                                    responses: { select: { id: true, questionId: true } },
                                    test: {
                                        select: {
                                            id: true,
                                            questions: {
                                                select: {
                                                    id: true,
                                                    type: true,
                                                    correctAnswer: true,
                                                    correctAnswers: true,
                                                    score: true,
                                                },
                                                orderBy: { order: 'asc' },
                                            },
                                        },
                                    },
                                },
                            })];
                        case 1:
                            submission = _j.sent();
                            if (!submission)
                                throw new common_1.NotFoundException('Submission nenalezena');
                            return [4 /*yield*/, this.getActiveMembership(user)];
                        case 2:
                            membership = _j.sent();
                            this.assertSameOrg(submission.assignment.organizationId, membership.organizationId);
                            if (submission.studentId !== membership.id) {
                                throw new common_1.ForbiddenException('Access denied');
                            }
                            if (submission.submittedAt) {
                                throw new common_1.BadRequestException('Submission již byla odevzdána');
                            }
                            now = new Date();
                            if (now < submission.assignment.openAt)
                                throw new common_1.BadRequestException('Assignment ještě není otevřen');
                            if (now > submission.assignment.closeAt)
                                throw new common_1.ForbiddenException('Assignment je uzavřen');
                            incoming = (_c = dto.responses) !== null && _c !== void 0 ? _c : [];
                            if (!(incoming.length > 0)) return [3 /*break*/, 6];
                            test_1 = submission.test;
                            validQuestionIds = new Set(((_d = test_1 === null || test_1 === void 0 ? void 0 : test_1.questions) !== null && _d !== void 0 ? _d : []).map(function (q) { return q.id; }));
                            _loop_2 = function (r) {
                                var existing, e_2;
                                return __generator(this, function (_k) {
                                    switch (_k.label) {
                                        case 0:
                                            if (!validQuestionIds.has(r.questionId)) {
                                                throw new common_1.BadRequestException('Nevalidní questionId');
                                            }
                                            existing = submission.responses.find(function (x) { return x.questionId === r.questionId; });
                                            _k.label = 1;
                                        case 1:
                                            _k.trys.push([1, 6, , 7]);
                                            if (!existing) return [3 /*break*/, 3];
                                            return [4 /*yield*/, this_2.prisma.response.update({
                                                    where: { id: existing.id },
                                                    data: { givenText: r.givenText },
                                                })];
                                        case 2:
                                            _k.sent();
                                            return [3 /*break*/, 5];
                                        case 3: return [4 /*yield*/, this_2.prisma.response.create({
                                                data: {
                                                    submissionId: submission.id,
                                                    questionId: r.questionId,
                                                    givenText: r.givenText,
                                                },
                                            })];
                                        case 4:
                                            _k.sent();
                                            _k.label = 5;
                                        case 5: return [3 /*break*/, 7];
                                        case 6:
                                            e_2 = _k.sent();
                                            if (e_2.code === 'P2003' || e_2.code === 'P2023') {
                                                throw new common_1.BadRequestException('Nevalidní questionId');
                                            }
                                            throw e_2;
                                        case 7: return [2 /*return*/];
                                    }
                                });
                            };
                            this_2 = this;
                            _i = 0, incoming_1 = incoming;
                            _j.label = 3;
                        case 3:
                            if (!(_i < incoming_1.length)) return [3 /*break*/, 6];
                            r = incoming_1[_i];
                            return [5 /*yield**/, _loop_2(r)];
                        case 4:
                            _j.sent();
                            _j.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6: return [4 /*yield*/, this.prisma.response.findMany({
                                where: { submissionId: submission.id },
                                select: { id: true, questionId: true, givenText: true },
                            })];
                        case 7:
                            dbResponses = _j.sent();
                            total = 0;
                            maxScore = 0;
                            _loop_3 = function (q) {
                                var resp, given, correct, gained, qScore, corr, giv;
                                return __generator(this, function (_l) {
                                    switch (_l.label) {
                                        case 0:
                                            resp = dbResponses.find(function (r) { return r.questionId === q.id; });
                                            given = resp === null || resp === void 0 ? void 0 : resp.givenText;
                                            correct = false;
                                            gained = 0;
                                            qScore = (_e = q.score) !== null && _e !== void 0 ? _e : 1;
                                            maxScore += qScore;
                                            if (q.type === client_1.QuestionType.TRUE_FALSE) {
                                                correct =
                                                    String(given !== null && given !== void 0 ? given : '').toLowerCase() ===
                                                        String((_f = q.correctAnswer) !== null && _f !== void 0 ? _f : '').toLowerCase();
                                                gained = correct ? qScore : 0;
                                            }
                                            else if (q.type === client_1.QuestionType.FILL_IN_THE_BLANK) {
                                                correct =
                                                    this_3.normalizeFitb(String(given)) ===
                                                        this_3.normalizeFitb((_g = q.correctAnswer) !== null && _g !== void 0 ? _g : '');
                                                gained = correct ? qScore : 0;
                                            }
                                            else if (q.type === client_1.QuestionType.MULTIPLE_CHOICE) {
                                                if (Array.isArray(q.correctAnswers)) {
                                                    corr = __spreadArray([], q.correctAnswers, true).sort().join(',');
                                                    giv = Array.isArray(given)
                                                        ? __spreadArray([], given, true).sort().join(',')
                                                        : String(given !== null && given !== void 0 ? given : '');
                                                    correct = corr === giv;
                                                }
                                                else {
                                                    // single: string
                                                    correct = String(given !== null && given !== void 0 ? given : '') === String((_h = q.correctAnswer) !== null && _h !== void 0 ? _h : '');
                                                }
                                                gained = correct ? qScore : 0;
                                            }
                                            if (!resp) return [3 /*break*/, 2];
                                            return [4 /*yield*/, this_3.prisma.response.update({
                                                    where: { id: resp.id },
                                                    data: { isCorrect: correct },
                                                })];
                                        case 1:
                                            _l.sent();
                                            _l.label = 2;
                                        case 2:
                                            total += gained;
                                            return [2 /*return*/];
                                    }
                                });
                            };
                            this_3 = this;
                            _a = 0, _b = submission.test.questions;
                            _j.label = 8;
                        case 8:
                            if (!(_a < _b.length)) return [3 /*break*/, 11];
                            q = _b[_a];
                            return [5 /*yield**/, _loop_3(q)];
                        case 9:
                            _j.sent();
                            _j.label = 10;
                        case 10:
                            _a++;
                            return [3 /*break*/, 8];
                        case 11:
                            normalizedScore = maxScore > 0 ? total / maxScore : 0;
                            return [4 /*yield*/, this.prisma.submission.update({
                                    where: { id: submission.id },
                                    data: {
                                        submittedAt: new Date(),
                                        status: client_1.SubmissionStatus.APPROVED,
                                        score: normalizedScore,
                                    },
                                })];
                        case 12:
                            finished = _j.sent();
                            return [2 /*return*/, finished];
                    }
                });
            });
        };
        SubmissionsService_1.prototype.findAll = function (filter, user) {
            return __awaiter(this, void 0, void 0, function () {
                var membership, where;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getActiveMembership(user)];
                        case 1:
                            membership = _a.sent();
                            where = {
                                assignment: { organizationId: membership.organizationId },
                            };
                            if (filter.assignmentId)
                                where.assignmentId = filter.assignmentId;
                            // STUDENT vidí jen své
                            if (String(membership.role) === 'STUDENT') {
                                where.studentId = membership.id;
                            }
                            else if (filter.studentId) {
                                where.studentId = filter.studentId;
                            }
                            return [2 /*return*/, this.prisma.submission.findMany({
                                    where: where,
                                    include: { responses: true },
                                    orderBy: { createdAt: 'desc' },
                                })];
                    }
                });
            });
        };
        SubmissionsService_1.prototype.findOne = function (id, user) {
            return __awaiter(this, void 0, void 0, function () {
                var membership, submission;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.getActiveMembership(user)];
                        case 1:
                            membership = _a.sent();
                            return [4 /*yield*/, this.prisma.submission.findUnique({
                                    where: { id: id },
                                    include: {
                                        responses: true,
                                        assignment: { select: { organizationId: true } },
                                    },
                                })];
                        case 2:
                            submission = _a.sent();
                            if (!submission)
                                throw new common_1.NotFoundException('Submission nenalezena');
                            this.assertSameOrg(submission.assignment.organizationId, membership.organizationId);
                            if (String(membership.role) === 'STUDENT' &&
                                submission.studentId !== membership.id) {
                                throw new common_1.ForbiddenException('Access denied');
                            }
                            return [2 /*return*/, submission];
                    }
                });
            });
        };
        return SubmissionsService_1;
    }());
    __setFunctionName(_classThis, "SubmissionsService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        SubmissionsService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return SubmissionsService = _classThis;
}();
exports.SubmissionsService = SubmissionsService;
