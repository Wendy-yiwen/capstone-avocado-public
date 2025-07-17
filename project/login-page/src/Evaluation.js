import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import DashboardPage from "./Dashboard";
import { supabase } from "./supabaseClient";

// Evaluation Page for submitting peer reviews
const EvaluationPage = () => {
  const username = localStorage.getItem("zid") || null;
  const courseCode = localStorage.getItem("selectedCourse") || null;
  console.log("👤 EvaluationPage username:", username);

  const [groupId, setGroupId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [submitted, setSubmitted] = useState({}); // { aid: true }
  const [members, setMembers] = useState([]);
  const [scores, setScores] = useState({}); // { aid: { zid: 0–10 } }
  const [comments, setComments] = useState({}); // { aid: { zid: "" } }
  const [modalAid, setModalAid] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the user's group in the selected course
  useEffect(() => {
    if (!courseCode) return;

    const fetchGroup = async () => {
      const { data: courseGroups, error: cgErr } = await supabase
        .from("groups")
        .select("id")
        .eq("course_code", courseCode);

      if (cgErr || !courseGroups.length) {
        console.error("⚠️ No group rows for course", cgErr);
        setLoading(false);
        return;
      }

      const groupIds = courseGroups.map((g) => g.id);
      const { data: myRow, error: mrErr } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("member_zid", username)
        .in("group_id", groupIds)
        .single();

      if (mrErr || !myRow) {
        console.error(
          "⚠️ You are not assigned to a group for this course",
          mrErr
        );
        setLoading(false);
        return;
      }

      setGroupId(myRow.group_id);
    };

    setGroupId(null);
    setAssignments([]);
    setSubmitted({});
    setMembers([]);
    setScores({});
    setComments({});
    setModalAid(null);
    setLoading(true);

    fetchGroup();
  }, [courseCode, username]);

  // Fetch assignments and submitted reviews
  useEffect(() => {
    if (!groupId) return;

    const fetchData = async () => {
      const { data: aData } = await supabase
        .from("assignments")
        .select("*")
        .eq("course_code", courseCode)
        .order("due_date", { ascending: true });
      setAssignments(aData || []);

      const { data: rData } = await supabase
        .from("peer_reviews")
        .select("assignment_id")
        .eq("group_id", groupId)
        .eq("reviewer_zid", username);
      const done = {};
      (rData || []).forEach((r) => (done[r.assignment_id] = true));
      setSubmitted(done);

      setLoading(false);
    };

    fetchData();
  }, [groupId, courseCode, username]);

  // Fetch group members
  useEffect(() => {
    if (!groupId) return;

    supabase
      .from("group_members")
      .select("member_zid, users(name)")
      .eq("group_id", groupId)
      .then(({ data }) => {
        const list = (data || []).map((d) => ({
          zid: d.member_zid,
          name: d.users.name,
        }));
        setMembers(list);

        const initS = {},
          initC = {};
        assignments.forEach((a) => {
          initS[a.id] = {};
          initC[a.id] = {};
          list.forEach((m) => {
            initS[a.id][m.zid] = 0;
            initC[a.id][m.zid] = "";
          });
        });
        setScores(initS);
        setComments(initC);
      });
  }, [groupId, assignments]);

  // Modal controls
  const openModal = (aid) => setModalAid(aid);
  const closeModal = () => setModalAid(null);

  // Update score or comment for a member
  const handleSlider = (aid, zid, v) =>
    setScores((p) => ({ ...p, [aid]: { ...p[aid], [zid]: Number(v) } }));

  const handleComment = (aid, zid, v) =>
    setComments((p) => ({ ...p, [aid]: { ...p[aid], [zid]: v } }));

  // Submit the peer review for an assignment
  const submitEval = async (aid) => {
    try {
      await supabase
        .from("peer_reviews")
        .delete()
        .eq("group_id", groupId)
        .eq("assignment_id", aid)
        .eq("reviewer_zid", username);

      const rows = members.map((m) => ({
        group_id: groupId,
        assignment_id: aid,
        reviewer_zid: username,
        reviewee_zid: m.zid,
        score: Number(scores[aid][m.zid]),
        comment: comments[aid][m.zid] || "",
      }));
      const { error } = await supabase.from("peer_reviews").insert(rows);
      if (error) throw error;

      setSubmitted((p) => ({ ...p, [aid]: true }));
      closeModal();
    } catch (err) {
      console.error("❌ Submit failed:", err.message, err.details || "");
      alert("Submit failed: " + err.message);
    }
  };

  if (loading) {
    return (
      <>
        <DashboardPage />
        <div className="pl-80 px-6 py-10 text-gray-500">Loading…</div>
      </>
    );
  }

  return (
    <>
      <DashboardPage />
      <div className="pl-80 px-8 py-10">
        <h2 className="text-2xl font-bold mb-6">
          📝 Assignments to Evaluate ({courseCode})
        </h2>

        {/* Assignment cards */}
        {assignments.map((a) => (
          <div
            key={a.id}
            className="mb-6 border rounded-lg p-6 bg-white shadow"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-lg font-semibold">{a.name}</div>
                <div className="text-sm text-gray-500">
                  Due: {new Date(a.due_date).toLocaleDateString()}
                </div>
              </div>

              {submitted[a.id] ? (
                <span className="text-green-600 font-medium">✅ Submitted</span>
              ) : (
                <button
                  onClick={() => openModal(a.id)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded"
                >
                  Start Evaluation
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Evaluation Modal */}
      {modalAid && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-[95%] max-w-2xl rounded-lg p-6 shadow-lg overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                Evaluation – {assignments.find((a) => a.id === modalAid)?.name}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✖
              </button>
            </div>

            {/* Evaluation form */}
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <h4 className="text-lg font-semibold mb-2">Peer Evaluation</h4>
              <p className="text-gray-700 mb-2">
                You are evaluating your group members' contributions in&nbsp;
                <strong>
                  {assignments.find((a) => a.id === modalAid)?.name} – Group {groupId}
                </strong>
                .
              </p>
              <h5 className="font-medium mb-1">👫 Group Members:</h5>
              <ul className="list-disc list-inside text-blue-600 space-y-1 mb-3">
                {members.map((m) => (
                  <li key={m.zid}>{m.name}</li>
                ))}
              </ul>
              <p className="font-semibold">• Rate each member from 0 to 10.</p>
              <p className="text-red-600 font-medium">
                • Be fair and honest. Comments are optional.
              </p>
            </div>

            {/* Member evaluations */}
            <div className="space-y-6">
              {members.map((m) => (
                <div key={m.zid} className="border p-4 rounded-md shadow-sm">
                  <div className="font-semibold mb-2">{m.name}</div>

                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={scores[modalAid]?.[m.zid] ?? 0}
                    onChange={(e) =>
                      handleSlider(modalAid, m.zid, e.target.value)
                    }
                    className="w-full"
                  />
                  <div className="text-right text-sm text-indigo-700">
                    {scores[modalAid]?.[m.zid] ?? 0} / 10
                  </div>

                  <textarea
                    rows="2"
                    className="w-full border rounded-md p-2 text-sm mt-2"
                    placeholder="Comment (optional)"
                    value={comments[modalAid]?.[m.zid] || ""}
                    onChange={(e) =>
                      handleComment(modalAid, m.zid, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => submitEval(modalAid)}
                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EvaluationPage;
